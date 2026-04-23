// app/api/auth/signup/route.ts
// POST /api/auth/signup
// Self-service account creation.
// Validates fields, creates Supabase auth user (email auto-confirmed),
// inserts profile row (display_id assigned by DB sequence), sets session cookie.

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { setSession }                from "@/lib/auth";
import {
  checkSignupRateLimit,
  getClientIp,
  getUserAgent,
  logAuthEvent,
} from "@/lib/password-reset";

// Use anon key — same pattern as login route
function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Same rule used by /api/profile and /api/auth/username-available
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
  // Per-IP only — signups are rare legitimate events, so capping by IP
  // stops automated account creation without tracking by email.
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

  // ── Validate username (required, unique) ────────────────────
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

  const { data: taken, error: takenErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (takenErr) {
    return NextResponse.json({ error: takenErr.message }, { status: 500 });
  }
  if (taken) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  }

  // ── Create auth user (service role — auto-confirms email) ───
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:         normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name: cleanDisplay, role: "user" },
  });

  if (authError) {
    // Surface common duplicate email error in a friendly way
    const msg = authError.message.toLowerCase().includes("already")
      ? "An account with this email already exists."
      : authError.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = authData.user.id;

  // ── Insert profile row (display_id auto-assigned by sequence) ──
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id:             userId,
      display_name:   cleanDisplay,
      username,
      access_flags:   [],
      session_status: "OFFLINE",
      last_login_ip:  "0.0.0.0",
      last_active:    new Date().toISOString(),
    });

  if (profileError) {
    // Roll back the auth user so the signup is fully atomic
    await supabaseAdmin.auth.admin.deleteUser(userId);
    // Unique-index violation (e.g. concurrent signup grabbed the same username)
    if (profileError.code === "23505") {
      return NextResponse.json(
        { error: "Username is already taken." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // ── Sign in to verify credentials + set session cookie ──────
  const anonClient = getAnonClient();
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email:    normalizedEmail,
    password,
  });

  if (signInError || !signInData.user) {
    // Account created but we can't auto-login — let them log in manually
    return NextResponse.json({ ok: true, redirect: "/login" });
  }

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
