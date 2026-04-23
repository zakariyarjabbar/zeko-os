// app/api/auth/signup/route.ts
// POST /api/auth/signup
// Final registration step — called only AFTER email is pre-verified via
// /api/auth/email-verify/send + /api/auth/email-verify/check.
//
// Checks the email_pre_verifications record (must be verified=true, not
// expired), updates the temp Supabase user with the real password and
// metadata, inserts the profile row, and issues the session cookie.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { setSession }                from "@/lib/auth";
import {
  checkSignupRateLimit,
  getClientIp,
  getUserAgent,
  logAuthEvent,
} from "@/lib/password-reset";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/;

export async function POST(req: NextRequest) {
  let body: {
    email?:       string;
    password?:    string;
    displayName?: string;
    username?:    string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, password, displayName, username: rawUsername } = body;

  // ── Validate required fields ────────────────────────────────
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  // ── Rate-limit check ────────────────────────────────────────
  const rl = await checkSignupRateLimit(ip);
  if (!rl.ok) {
    await logAuthEvent("signup_rl", { email: normalizedEmail, ip });
    return NextResponse.json(
      {
        error:          "Too many signup attempts. Please wait before trying again.",
        retryInSeconds: rl.retryInSeconds ?? 3600,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryInSeconds ?? 3600) } },
    );
  }

  await logAuthEvent("signup_attempt", { email: normalizedEmail, ip });

  const cleanDisplay = (displayName ?? "").trim();
  if (!cleanDisplay) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }
  if ((cleanDisplay.match(/ /g) ?? []).length > 1) {
    return NextResponse.json(
      { error: "Display name may contain at most one space." },
      { status: 400 }
    );
  }

  // ── Validate username ───────────────────────────────────────
  const username = (rawUsername ?? "").trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "3–20 chars: lowercase letters, numbers, dots, dashes, underscores." },
      { status: 400 }
    );
  }

  // ── Check email is pre-verified ─────────────────────────────
  const { data: preVerify } = await supabaseAdmin
    .from("email_pre_verifications")
    .select("user_id, verified, expires_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!preVerify || !(preVerify.verified as boolean)) {
    return NextResponse.json(
      { error: "Email not verified. Please verify your email before registering." },
      { status: 403 },
    );
  }

  if (new Date(preVerify.expires_at as string) <= new Date()) {
    await supabaseAdmin.from("email_pre_verifications").delete().eq("email", normalizedEmail);
    return NextResponse.json(
      { error: "Verification session expired. Please verify your email again." },
      { status: 403 },
    );
  }

  const userId = preVerify.user_id as string;

  // ── Username uniqueness ─────────────────────────────────────
  const { data: taken } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  }

  // ── Set the real password + metadata on the temp Supabase user ──
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
    user_metadata: { name: cleanDisplay, role: "user" },
  });

  if (updateError) {
    console.error("[signup] updateUserById error:", updateError.message);
    return NextResponse.json({ error: "Failed to complete registration." }, { status: 500 });
  }

  // ── Insert profile row ──────────────────────────────────────
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id:             userId,
      display_name:   cleanDisplay,
      username,
      access_flags:   [],
      session_status: "OFFLINE",
      last_login_ip:  ip,
      last_active:    new Date().toISOString(),
    });

  if (profileError) {
    console.error("[signup] profile insert:", profileError.message);
    if (profileError.code === "23505") {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // ── Clean up pre-verification record ───────────────────────
  await supabaseAdmin.from("email_pre_verifications").delete().eq("email", normalizedEmail);

  // ── Issue session cookie ────────────────────────────────────
  await setSession({
    id:        userId,
    email:     normalizedEmail,
    name:      cleanDisplay,
    role:      "user",
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
