// app/api/auth/reset-password/verify/route.ts
// POST /api/auth/reset-password/verify    body: { email, code, newPassword }
//
// Verification pipeline (fail-closed at every step, constant-ish error text):
//   1. Parse + format-gate all fields.
//   2. Per-IP rate-limit on the verify endpoint.
//   3. Load our own active code row for this email.
//        · no row               → generic "invalid or expired"
//        · row.expires_at passed → generic + mark row consumed
//        · row.attempts >= cap  → generic + mark row consumed
//   4. Increment the attempt counter BEFORE calling Supabase, so a
//      network error still counts against the cap.
//   5. Delegate cryptographic check to Supabase: verifyOtp(type='email').
//      On failure → log "reset_verify_fail", return generic error.
//   6. On success: updateUser({ password }) using Supabase's just-minted
//      session, mark our row consumed, mint our HMAC session cookie,
//      and return ok.
//
// Security notes:
//   · The 6-digit code is never stored or logged. Supabase holds it.
//   · Attempts are rate-limited per-code (5) AND per-IP (20/15min) — both
//     required to defeat distributed online brute force.
//   · The error text is uniform — "Invalid or expired code." — regardless
//     of whether the code was wrong, expired, already used, or the email
//     had no request. This prevents oracles.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { setSession } from "@/lib/auth";
import { asUserId } from "@/lib/types/ids";
import {
  MAX_ATTEMPTS_PER_CODE,
  checkVerifyRateLimit,
  findActiveCode,
  getClientIp,
  getUserAgent,
  incrementAttempts,
  logAuthEvent,
  markConsumed,
} from "@/lib/password-reset";
import { revokeAllForUser } from "@/lib/sessions";

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE  = /^\d{6,8}$/;

// Single message for all non-success verification paths.
const GENERIC_INVALID = "Invalid or expired code. Request a new one.";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  // ── Parse + format gate ──────────────────────────────────────
  let body: { email?: string; code?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email       = (body.email ?? "").trim().toLowerCase();
  const code        = (body.code  ?? "").trim();
  const newPassword = body.newPassword ?? "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: GENERIC_INVALID }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  // ── Per-IP rate limit (independent of email) ─────────────────
  const rl = await checkVerifyRateLimit(ip);
  if (!rl.ok) {
    await logAuthEvent("reset_verify_rl", { email, ip });
    return NextResponse.json(
      { error: "Too many attempts. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rl.retryInSeconds ?? 900) } },
    );
  }

  // ── Find our active code row (our 2-min expiry + attempt cap) ─
  const row = await findActiveCode(email);
  if (!row) {
    await logAuthEvent("reset_verify_fail", { email, ip, success: false });
    return NextResponse.json({ error: GENERIC_INVALID }, { status: 400 });
  }

  // ── Attempts cap pre-check ───────────────────────────────────
  if (row.attempts >= MAX_ATTEMPTS_PER_CODE) {
    await markConsumed(row.id);
    await logAuthEvent("reset_verify_fail", { email, ip, success: false });
    return NextResponse.json({ error: GENERIC_INVALID }, { status: 400 });
  }

  // ── Count this attempt BEFORE Supabase call ──────────────────
  // Doing this first means even a thrown fetch error still burns an attempt,
  // which blocks a retry-to-drain strategy.
  const attemptsAfter = await incrementAttempts(row.id);

  // ── Cryptographic check: delegate to Supabase ────────────────
  const anon = getAnonClient();
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    email,
    token: code,
    type:  "recovery",
  });

  if (otpErr || !otpData.user || !otpData.session) {
    // Exhaust the code if we hit the cap.
    if (attemptsAfter >= MAX_ATTEMPTS_PER_CODE) {
      await markConsumed(row.id);
    }
    await logAuthEvent("reset_verify_fail", { email, ip, success: false });
    return NextResponse.json({ error: GENERIC_INVALID }, { status: 400 });
  }

  // ── Update password using the just-minted Supabase session ───
  // The anon client holds the session set by verifyOtp, so updateUser
  // runs as the target user with no service-role escalation.
  const { error: updateErr } = await anon.auth.updateUser({ password: newPassword });
  if (updateErr) {
    // Don't re-expose attempts; treat as a one-shot failure + consume the code.
    await markConsumed(row.id);
    await logAuthEvent("reset_verify_fail", { email, ip, success: false });
    return NextResponse.json(
      { error: updateErr.message ?? "Failed to update password." },
      { status: 400 },
    );
  }

  // ── Single-use: burn the code immediately on success ─────────
  await markConsumed(row.id);
  await logAuthEvent("reset_verify_ok", { email, ip, success: true });

  // ── Mint our HMAC session cookie (same derivation as /login) ─
  const user = otpData.user;
  const meta = (user.user_metadata ?? {}) as Record<string, string>;

  let role = meta.role ?? "user";
  if (!meta.role) {
    const flags = await getEffectiveFlags(asUserId(user.id));
    if (flags.includes("Administrator")) role = "admin";
  }

  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();
  const p = profileRow as { display_name: string; username: string } | null;
  const displayName =
    p?.display_name?.trim() ||
    meta.name?.trim() ||
    p?.username ||
    (user.email ?? "user").split("@")[0];

  // ── Blast-radius containment ─────────────────────────────────
  // A password reset is a trust-boundary event: the actor either forgot
  // their password, OR an attacker is stealing the account. In both
  // cases, every pre-existing signed-in device for this user should
  // lose its session. If the legit user was actually signed in
  // elsewhere, they can sign back in with their new password.
  await revokeAllForUser(user.id);

  await setSession({
    id:        user.id,
    email:     user.email!,
    name:      displayName,
    role,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
