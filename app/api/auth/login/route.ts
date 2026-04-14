// app/api/auth/login/route.ts
// POST /api/auth/login
// Validates credentials via Supabase Auth and sets a session cookie.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { setSession } from "@/lib/auth";

// Use anon key for sign-in — never the service role
function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, password } = body;

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // ── Sign in via Supabase Auth ────────────────────────────────
  const client = getAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    console.error("[login] auth error:", error?.message);
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const user = data.user;
  const meta = (user.user_metadata ?? {}) as Record<string, string>;

  // ── Derive role from profile if not stored in user metadata ──
  let role = meta.role ?? "user";
  if (!meta.role) {
    const flags = await getEffectiveFlags(user.id);
    if (flags.includes("Administrator")) role = "admin";
  }

  // ── Derive display name (username) ──────────────────────────
  let displayName = meta.name;
  if (!displayName) {
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    const p = profileRow as { username: string } | null;
    displayName = p?.username ?? email.split("@")[0];
  }

  // ── Set session cookie ───────────────────────────────────────
  await setSession({
    id:    user.id,
    email: user.email!,
    name:  displayName,
    role,
  });

  return NextResponse.json({ ok: true, name: displayName });
}
