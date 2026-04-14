// app/api/auth/signup/route.ts
// POST /api/auth/signup
// Self-service account creation.
// Validates fields, creates Supabase auth user (email auto-confirmed),
// inserts profile row (display_id assigned by DB sequence), sets session cookie.

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { setSession }                from "@/lib/auth";

// Use anon key — same pattern as login route
function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, password, displayName } = body;

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

  // Derive username from email local part
  const username = email.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9._-]/g, "");

  // ── Create auth user (service role — auto-confirms email) ───
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:         email.trim().toLowerCase(),
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
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // ── Sign in to verify credentials + set session cookie ──────
  const anonClient = getAnonClient();
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email:    email.trim().toLowerCase(),
    password,
  });

  if (signInError || !signInData.user) {
    // Account created but we can't auto-login — let them log in manually
    return NextResponse.json({ ok: true, redirect: "/login" });
  }

  await setSession({
    id:    userId,
    email: email.trim().toLowerCase(),
    name:  cleanDisplay,
    role:  "user",
  });

  return NextResponse.json({ ok: true });
}
