// app/api/users/route.ts
// GET  /api/users — list users  (moderator | admin | Administrator)
// POST /api/users — create user (admin | Administrator)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { canViewUsers, canCreateUsers } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const flags = await getEffectiveFlags(session.id);
  if (!canViewUsers(flags)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_id, username, first_name, last_name, alias, department, access_flags, session_status");

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

  const flags = await getEffectiveFlags(session.id);
  if (!canCreateUsers(flags)) {
    return NextResponse.json({ error: "Forbidden. admin or Administrator permission required." }, { status: 403 });
  }

  let body: {
    email?:       string;
    password?:    string;
    firstName?:   string;
    lastName?:    string;
    username?:    string;
    role?:        string;
    displayId?:   string;
    department?:  string;
    accessFlags?: string[];
    roleIds?:     string[];
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const { email, password, firstName, lastName, username, role,
          displayId, department, accessFlags, roleIds } = body;

  if (!email?.trim() || !password || !firstName?.trim() || !username?.trim()) {
    return NextResponse.json({ error: "email, password, firstName, and username are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:         email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: `${firstName} ${lastName ?? ""}`.trim(), role: role ?? "user" },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const userId = authData.user.id;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id:             userId,
      display_id:     displayId   ?? "user-0",
      username:       username.trim(),
      first_name:     firstName.trim(),
      last_name:      lastName?.trim() ?? "",
      alias:          username.trim(),
      department:     department  ?? "Unassigned",
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
