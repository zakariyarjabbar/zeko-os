// app/api/auth/email-verify/check/route.ts
// POST /api/auth/email-verify/check    body: { email, code }
//
// Verifies the 6-digit OTP and marks the email_pre_verifications record as
// verified. The final registration (signup) call uses this verified state.

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { supabaseAdmin }             from "@/lib/supabase/server";
import {
  checkEmailVerifyRateLimit,
  getClientIp,
  logAuthEvent,
} from "@/lib/password-reset";

const VERIFIED_TTL_SECONDS = 1800; // 30 min to fill out the rest of the form
const GENERIC_ERROR = "Invalid or expired code.";

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const code  = (body.code  ?? "").trim();
  const ip    = getClientIp(req);

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }

  // ── Per-IP rate-limit on failed verify attempts ─────────────
  const rl = await checkEmailVerifyRateLimit(ip);
  if (!rl.ok) {
    await logAuthEvent("email_verify_rl", { email, ip });
    return NextResponse.json(
      {
        error:          "Too many attempts. Please wait before trying again.",
        retryInSeconds: rl.retryInSeconds ?? 900,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryInSeconds ?? 900) } },
    );
  }

  // ── Look up pre-verification record ─────────────────────────
  const { data: record } = await supabaseAdmin
    .from("email_pre_verifications")
    .select("user_id, verified, expires_at")
    .eq("email", email)
    .maybeSingle();

  if (!record) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  if (new Date(record.expires_at as string) <= new Date()) {
    // Expired — clean up so user can try again from the start.
    await Promise.all([
      supabaseAdmin.auth.admin.deleteUser(record.user_id as string),
      supabaseAdmin.from("email_pre_verifications").delete().eq("email", email),
    ]);
    return NextResponse.json(
      { error: "Code expired. Please request a new one.", expired: true },
      { status: 400 },
    );
  }

  // ── Verify OTP with Supabase ────────────────────────────────
  const anon = getAnonClient();
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    email,
    token: code,
    type:  "email",
  });

  if (verifyError || !verifyData.user) {
    await logAuthEvent("email_verify_fail", { email, ip, success: false });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // ── Mark verified, extend window ────────────────────────────
  const newExpiry = new Date(Date.now() + VERIFIED_TTL_SECONDS * 1000);
  await supabaseAdmin
    .from("email_pre_verifications")
    .update({ verified: true, expires_at: newExpiry.toISOString() })
    .eq("email", email);

  await logAuthEvent("email_verify_ok", { email, ip, success: true });

  return NextResponse.json({ ok: true });
}
