// app/api/users/route.ts
// GET  /api/users — list users  (moderator | admin | Administrator)
// POST /api/users — create user (admin | Administrator)
//
// display_id is assigned automatically by the DB sequence — never passed from the client.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { asUserId } from "@/lib/types/ids";
import { canViewUsers, canCreateUsers } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const flags = await getEffectiveFlags(asUserId(session.id));
  if (!canViewUsers(flags)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_id, display_name, username, access_flags, session_status");

  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role_id, roles(id, name)");

  const roleMap = new Map<string, { id: string; name: string }[]>();
  (userRoles ?? []).forEach((ur: { user_id: string; role_id: string; roles: unknown }) => {
    const role = ur.roles as { id: string; name: string } | null;
    if (!role) return;
    const existing = roleMap.get(ur.user_id) ?? [];
    existing.push(role);
    roleMap.set(ur.user_id, existing);
  });

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const users = authData.users.map((u) => {
    const p = profileMap.get(u.id);
    return {
      id:             u.id,
      email:          u.email,
      emailConfirmed: !!u.email_confirmed_at,
      createdAt:      u.created_at,
      lastSignIn:     u.last_sign_in_at ?? null,
      profile:        p ?? null,
      roles:          roleMap.get(u.id) ?? [],
    };
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const flags = await getEffectiveFlags(asUserId(session.id));
  if (!canCreateUsers(flags)) {
    return NextResponse.json({ error: "Forbidden. admin or Administrator permission required." }, { status: 403 });
  }

  let body: {
    email?:        string;
    password?:     string;
    username?:     string;
    displayName?:  string;
    role?:         string;
    accessFlags?:  string[];
    roleIds?:      string[];
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const { email, password, username, displayName, role, accessFlags, roleIds } = body;

  if (!email?.trim() || !password || !username?.trim()) {
    return NextResponse.json(
      { error: "email, password, and username are required." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  // display_name: letters, numbers, spaces — max one space
  const cleanDisplayName = (displayName ?? "").trim();
  if (cleanDisplayName && (cleanDisplayName.match(/ /g) ?? []).length > 1) {
    return NextResponse.json({ error: "Display name may contain at most one space." }, { status: 400 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:         email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: cleanDisplayName || username.trim(), role: role ?? "user" },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const userId = authData.user.id;

  // display_id is intentionally omitted — the DB sequence assigns it automatically
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id:             userId,
      display_name:   cleanDisplayName,
      username:       username.trim(),
      access_flags:   accessFlags ?? [],
      session_status: "OFFLINE",
      last_login_ip:  "0.0.0.0",
      last_active:    new Date().toISOString(),
    });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (roleIds && roleIds.length > 0) {
    await supabaseAdmin
      .from("user_roles")
      .insert(roleIds.map((rid) => ({ user_id: userId, role_id: rid })));
  }

  return NextResponse.json({ ok: true, id: userId });
}
