// app/api/auth/reset-password/request/route.ts
// POST /api/auth/reset-password/request    body: { email }
//
// Issues a 6-digit OTP that Supabase emails to the user (via the Magic Link
// template — configure `{{ .Token }}` in the template body). We wrap it with
// our own 2-minute expiry, per-code attempt cap, and per-email / per-IP rate
// limits. Response is always generic — no account enumeration.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CODE_TTL_SECONDS,
  checkRequestRateLimit,
  getClientIp, getUserAgent,
  invalidateActiveCodesFor,
  logAuthEvent,
  recordIssuedCode,
} from "@/lib/password-reset";

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Uniform response — never leak existence, format validity, or rate-limit
// reason beyond the generic "please wait" hint.
const GENERIC_OK = {
  ok: true,
  message: "If that email is registered, a 6-digit code has been sent.",
  ttlSeconds: CODE_TTL_SECONDS,
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();

  // Basic format gate. Purposely returns the same generic payload on success
  // path, but here we short-circuit obvious garbage to avoid hitting Supabase.
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  // ── Rate-limit check ──────────────────────────────────────────
  const rl = await checkRequestRateLimit(email, ip);
  if (!rl.ok) {
    await logAuthEvent("reset_request_rl", { email, ip });
    return NextResponse.json(
      {
        error:         "Too many requests. Please wait before trying again.",
        retryInSeconds: rl.retryInSeconds ?? 60,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryInSeconds ?? 60) } },
    );
  }

  // ── Invalidate any previous active codes for this email ──────
  // Single-code-active invariant: only the newest code can succeed.
  await invalidateActiveCodesFor(email);

  // ── Ask Supabase to email the recovery OTP ───────────────────
  // resetPasswordForEmail sends the "Reset password" template (not Magic Link)
  // and issues a type='recovery' token — cryptographically separate from
  // login tokens so it can't be replayed as a sign-in.
  // redirectTo is required by the API but irrelevant — we use the token, not the link.
  const anon = getAnonClient();
  const redirectTo = new URL("/reset-password", req.nextUrl.origin).toString();
  const { error: otpErr } = await anon.auth.resetPasswordForEmail(email, { redirectTo });

  if (otpErr) {
    // Log server-side only. Never surface — could leak existence ("user not found"),
    // rate-limit info, or SMTP state to the client.
    console.error("[reset-password/request] signInWithOtp error:", otpErr.message);
  }

  // ── Record our own request row so we can enforce 2-min expiry + attempt cap ──
  // We insert the row unconditionally — even for unknown emails — so timing
  // is indistinguishable between "user exists" and "user doesn't exist".
  try {
    await recordIssuedCode({ email, ip, userAgent: ua });
  } catch (err) {
    console.error("[reset-password/request] recordIssuedCode:", (err as Error).message);
  }

  // Audit this request (successful dispatch intent — not whether SMTP delivered).
  await logAuthEvent("reset_request", { email, ip, success: !otpErr });

  return NextResponse.json(GENERIC_OK);
}
