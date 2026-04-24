// app/api/auth/login/route.ts
// POST /api/auth/login
// Validates credentials via Supabase Auth and sets a session cookie.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { isFounder }               from "@/lib/permissions";
import { setSession } from "@/lib/auth";
import { asUserId } from "@/lib/types/ids";
import {
  checkLoginRateLimit,
  getClientIp,
  getUserAgent,
  logAuthEvent,
} from "@/lib/password-reset";

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

  const normalizedEmail = email.trim().toLowerCase();
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  // ── Rate-limit check ─────────────────────────────────────────
  // Blocks credential stuffing (per-IP across any outcome) and
  // per-account brute force (per-email failed attempts only).
  const rl = await checkLoginRateLimit(normalizedEmail, ip);
  if (!rl.ok) {
    await logAuthEvent("login_rl", { email: normalizedEmail, ip });
    return NextResponse.json(
      {
        error:          "Too many login attempts. Please wait before trying again.",
        retryInSeconds: rl.retryInSeconds ?? 900,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryInSeconds ?? 900) } },
    );
  }

  // Record the attempt before hitting Supabase so the per-IP bucket
  // counts requests regardless of whether the upstream call finishes.
  await logAuthEvent("login_attempt", { email: normalizedEmail, ip });

  // ── Sign in via Supabase Auth ────────────────────────────────
  const client = getAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    console.error("[login] auth error:", error?.message);
    await logAuthEvent("login_fail", { email: normalizedEmail, ip, success: false });
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const user = data.user;
  const meta = (user.user_metadata ?? {}) as Record<string, string>;

  // ── Derive role from profile if not stored in user metadata ──
  let role = meta.role ?? "user";
  if (!meta.role) {
    const { ids } = await getEffectivePermissions(asUserId(user.id));
    if (isFounder(ids)) role = "admin";
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
  // IP + UA are recorded on the user_sessions row so the Active
  // Sessions panel can show them. Other fields (email/name/role)
  // are resolved fresh from the DB on every getSession() call,
  // so we don't need to keep them in sync on the cookie.
  await setSession({
    id:        user.id,
    email:     user.email!,
    name:      displayName,
    role,
    persist:   persistSession === true,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true, name: displayName });
}
