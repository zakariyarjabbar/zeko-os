// app/api/auth/login/route.ts
// POST /api/auth/login
// Validates credentials via Supabase Auth and sets a session cookie.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { setSession } from "@/lib/auth";
import { asUserId } from "@/lib/types/ids";

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
  let body: { email?: string; password?: string; persistSession?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, password, persistSession } = body;

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
    const flags = await getEffectiveFlags(asUserId(user.id));
    if (flags.includes("Administrator")) role = "admin";
  }

  // ── Derive display name — prefer the DB's current display_name ──
  // profiles.display_name is the source of truth; user_metadata.name
  // is only a snapshot taken at signup and is never updated thereafter.
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
    email.split("@")[0];

  // ── Set session cookie ───────────────────────────────────────
  await setSession({
    id:      user.id,
    email:   user.email!,
    name:    displayName,
    role,
    persist: persistSession === true,
  });

  return NextResponse.json({ ok: true, name: displayName });
}
