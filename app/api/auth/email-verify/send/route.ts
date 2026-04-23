// app/api/auth/email-verify/send/route.ts
// POST /api/auth/email-verify/send    body: { email }
//
// Called when the user clicks "Send Code" on the signup form.
// Creates a temporary unconfirmed Supabase auth user (random password),
// dispatches an OTP via Supabase Magic Link email, and records the
// in-flight state in email_pre_verifications.
//
// Idempotent for the same email while not expired: re-uses the existing
// temp user and re-sends the OTP instead of creating a duplicate.

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { supabaseAdmin }             from "@/lib/supabase/server";
import {
  checkEmailResendRateLimit,
  getClientIp,
  logAuthEvent,
} from "@/lib/password-reset";

export const SEND_TTL_SECONDS = 600; // 10 minutes to enter the code

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const ip    = getClientIp(req);

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  // ── Rate-limit ──────────────────────────────────────────────
  const rl = await checkEmailResendRateLimit(email, ip);
  if (!rl.ok) {
    await logAuthEvent("email_verify_send_rl", { email, ip });
    return NextResponse.json(
      {
        error:          "Too many requests. Please wait before trying again.",
        retryInSeconds: rl.retryInSeconds ?? 60,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryInSeconds ?? 60) } },
    );
  }

  // ── Check for existing in-flight record ─────────────────────
  const { data: existing } = await supabaseAdmin
    .from("email_pre_verifications")
    .select("user_id, verified, expires_at")
    .eq("email", email)
    .maybeSingle();

  let userId: string;

  if (existing) {
    const isExpired = new Date(existing.expires_at as string) <= new Date();

    if (!isExpired && (existing.verified as boolean)) {
      // Already verified — user should complete registration, not resend.
      return NextResponse.json(
        { error: "Email already verified. Please complete your registration.", verified: true },
        { status: 409 },
      );
    }

    if (isExpired) {
      // Clean up the stale temp user + record so we start fresh.
      await Promise.all([
        supabaseAdmin.auth.admin.deleteUser(existing.user_id as string),
        supabaseAdmin.from("email_pre_verifications").delete().eq("email", email),
      ]);
      // Fall through to create a new user below.
      userId = await createTempUser(email);
    } else {
      // Active, unverified — reuse the existing temp user_id, just resend.
      userId = existing.user_id as string;
    }
  } else {
    // ── No record — try creating a fresh temp user ──────────────
    userId = await createTempUser(email);
  }

  if (!userId) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  // ── Dispatch OTP via Supabase (Magic Link template) ─────────
  const anon = getAnonClient();
  const { error: otpError } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (otpError) {
    console.error("[email-verify/send] signInWithOtp error:", otpError.message);
    // Clean up temp user if we just created it and can't send the email.
    if (!existing || new Date(existing.expires_at as string) <= new Date()) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    return NextResponse.json(
      { error: "Failed to send verification email. Please try again." },
      { status: 500 },
    );
  }

  // ── Upsert pre-verification record ─────────────────────────
  const expires = new Date(Date.now() + SEND_TTL_SECONDS * 1000);
  await supabaseAdmin
    .from("email_pre_verifications")
    .upsert(
      { email, user_id: userId, verified: false, expires_at: expires.toISOString() },
      { onConflict: "email" },
    );

  await logAuthEvent("email_verify_send", { email, ip, success: true });

  return NextResponse.json({ ok: true, ttlSeconds: SEND_TTL_SECONDS });
}

// Creates a Supabase auth user with a random temp password (never exposed).
// Returns user_id on success, or empty string if the email is already taken.
async function createTempUser(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: false,
    password:      crypto.randomUUID() + crypto.randomUUID(), // random, overwritten on register
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) return "";
    throw error;
  }

  return data.user.id;
}
