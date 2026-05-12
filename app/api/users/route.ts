// app/api/users/route.ts
// GET  /api/users — list users  (any authenticated user; access_flags hidden for non-permission-managers)
// POST /api/users — create user (permission-manager | Administrator)
//
// display_id is assigned automatically by the DB sequence — never passed from the client.

import { NextRequest } from "next/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { asUserId } from "@/lib/types/ids";
import { canCreateUsers, canViewUserPermissions } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  apiOk,
  badRequest,
  conflict,
  forbidden,
  internalError,
  requireSession,
} from "@/lib/api";
import { logSecurityAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { ids }     = await getEffectivePermissions(asUserId(session.id));
  const canViewPerms = canViewUserPermissions(ids);

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) {
    console.error("[users/list] auth admin error:", authError.message);
    return internalError(req);
  }

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_id, display_name, username, access_flags, session_status, last_active");

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
    const profile = p
      ? {
          ...p,
          last_active:  p.last_active ?? u.last_sign_in_at ?? null,
          access_flags: canViewPerms ? p.access_flags : undefined,
        }
      : null;
    return {
      id:             u.id,
      email:          u.email,
      emailConfirmed: !!u.email_confirmed_at,
      createdAt:      u.created_at,
      lastSignIn:     u.last_sign_in_at ?? null,
      profile,
      roles:          roleMap.get(u.id) ?? [],
    };
  });

  return apiOk(users);
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!canCreateUsers(ids)) {
    return forbidden("Forbidden. permission-manager or Administrator required.", req);
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
  catch { return badRequest("Invalid body.", req); }

  const { email, password, username, displayName, role, accessFlags, roleIds } = body;

  if (!email?.trim() || !password || !username?.trim()) {
    return badRequest("email, password, and username are required.", req);
  }
  if (password.length < 8) {
    return badRequest("Password must be at least 8 characters.", req);
  }

  const cleanDisplayName = (displayName ?? "").trim();
  if (cleanDisplayName && (cleanDisplayName.match(/ /g) ?? []).length > 1) {
    return badRequest("Display name may contain at most one space.", req);
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:         email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: cleanDisplayName || username.trim(), role: role ?? "user" },
  });

  if (authError) {
    console.error("[users/create] auth admin error:", authError.message);
    return badRequest("Unable to create user with the supplied credentials.", req);
  }

  const userId = authData.user.id;

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
    console.error("[users/create] profile insert error:", profileError.message);
    if (profileError.code === "23505") {
      return conflict("Username is already taken.", req);
    }
    return internalError(req);
  }

  if (roleIds && roleIds.length > 0) {
    await supabaseAdmin
      .from("user_roles")
      .insert(roleIds.map((rid) => ({ user_id: userId, role_id: rid })));
  }

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "user.create",
    targetType: "user",
    targetId: userId,
    targetSnapshot: {
      id: userId,
      label: cleanDisplayName || `@${username.trim()}`,
      username: username.trim(),
      displayName: cleanDisplayName || null,
      email: email.trim().toLowerCase(),
    },
    metadata: {
      email: email.trim().toLowerCase(),
      username: username.trim(),
      accessFlagsCount: accessFlags?.length ?? 0,
      roleIdsCount: roleIds?.length ?? 0,
    },
  });

  return apiOk({ ok: true, id: userId }, { status: 201 });
}
