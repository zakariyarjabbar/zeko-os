// app/api/users/[id]/route.ts
// PATCH  /api/users/:id — update user fields (per-field permission gates)
// DELETE /api/users/:id — delete user (Administrator only)
//
// Field gates:
//   username / displayName / password  → change-display-name | Administrator
//   access_flags                       → permission-manager  | Administrator
//   roleIds                            → roles-manager       | Administrator
//
// display_id is never editable — permanently assigned by DB sequence on account creation.

import { NextRequest } from "next/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { asUserId } from "@/lib/types/ids";
import {
  canEditAnyUser, canChangeDisplayName, canManagePermissions,
  canManageRoles, canDeleteUsers, isFounder,
} from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  apiOk,
  badRequest,
  forbidden,
  internalError,
  requireSession,
} from "@/lib/api";
import { logSecurityAuditEvent, type SecurityAuditDiff, type SecurityAuditSnapshot } from "@/lib/audit";

async function targetIsAdministrator(targetId: string): Promise<boolean> {
  const { ids } = await getEffectivePermissions(asUserId(targetId));
  return isFounder(ids);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { ids: actorIds } = await getEffectivePermissions(asUserId(session.id));

  if (!canEditAnyUser(actorIds)) {
    return forbidden("Forbidden.", req);
  }

  const { id } = await params;

  // Non-Administrator actors cannot modify an Administrator-flagged user
  if (!isFounder(actorIds) && await targetIsAdministrator(id)) {
    return forbidden("Forbidden. Cannot modify a user with Administrator permission.", req);
  }

  let body: {
    username?:     string;
    displayName?:  string;
    accessFlags?:  string[];
    roleIds?:      string[];
    password?:     string;
  };

  try { body = await req.json(); }
  catch { return badRequest("Invalid body.", req); }

  const { data: beforeProfile } = await supabaseAdmin
    .from("profiles")
    .select("display_id, display_name, username, access_flags")
    .eq("id", id)
    .maybeSingle();

  const { data: beforeRoles } = body.roleIds !== undefined && canManageRoles(actorIds)
    ? await supabaseAdmin
        .from("user_roles")
        .select("role_id")
        .eq("user_id", id)
    : { data: null };

  const before = beforeProfile as {
    display_id: number | null;
    display_name: string | null;
    username: string | null;
    access_flags: string[] | null;
  } | null;

  // ── Profile fields ────────────────────────────────────────────
  const profileUpdate: Record<string, unknown> = {};

  if (canChangeDisplayName(actorIds)) {
    if (body.username !== undefined) {
      profileUpdate.username = body.username;
    }
    if (body.displayName !== undefined) {
      const dn = body.displayName.trim();
      if ((dn.match(/ /g) ?? []).length > 1) {
        return badRequest("Display name may contain at most one space.", req);
      }
      profileUpdate.display_name = dn;
    }
  }

  if (body.accessFlags !== undefined && canManagePermissions(actorIds)) {
    profileUpdate.access_flags = body.accessFlags;
  }

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", id);
    if (error) {
      console.error("[users/update] profile update error:", error.message);
      return internalError(req);
    }
  }

  // ── Roles ─────────────────────────────────────────────────────
  if (body.roleIds !== undefined && canManageRoles(actorIds)) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    if (body.roleIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert(body.roleIds.map((rid) => ({ user_id: id, role_id: rid })));
      if (error) {
        console.error("[users/update] roles insert error:", error.message);
        return internalError(req);
      }
    }
  }

  // ── Password ──────────────────────────────────────────────────
  if (body.password && canChangeDisplayName(actorIds)) {
    if (body.password.length < 8) {
      return badRequest("Password must be at least 8 characters.", req);
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: body.password });
    if (error) {
      console.error("[users/update] password update error:", error.message);
      return internalError(req);
    }
  }

  const changedFields = [
    ...(body.username !== undefined && canChangeDisplayName(actorIds) ? ["username"] : []),
    ...(body.displayName !== undefined && canChangeDisplayName(actorIds) ? ["displayName"] : []),
    ...(body.accessFlags !== undefined && canManagePermissions(actorIds) ? ["accessFlags"] : []),
    ...(body.roleIds !== undefined && canManageRoles(actorIds) ? ["roleIds"] : []),
    ...(body.password && canChangeDisplayName(actorIds) ? ["password"] : []),
  ];

  const diff: SecurityAuditDiff = {};
  if (body.username !== undefined && canChangeDisplayName(actorIds)) {
    diff.username = { before: before?.username ?? null, after: body.username };
  }
  if (body.displayName !== undefined && canChangeDisplayName(actorIds)) {
    diff.displayName = { before: before?.display_name ?? null, after: body.displayName.trim() };
  }
  if (body.accessFlags !== undefined && canManagePermissions(actorIds)) {
    diff.accessFlags = { before: before?.access_flags ?? [], after: body.accessFlags };
  }
  if (body.roleIds !== undefined && canManageRoles(actorIds)) {
    diff.roleIds = {
      before: ((beforeRoles ?? []) as { role_id: string }[]).map((row) => row.role_id),
      after: body.roleIds,
    };
  }
  if (body.password && canChangeDisplayName(actorIds)) {
    diff.password = { before: "[redacted]", after: "[changed]" };
  }

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "user.update",
    targetType: "user",
    targetId: id,
    diff,
    metadata: {
      changedFields,
      accessFlagsCount: body.accessFlags?.length,
      roleIdsCount: body.roleIds?.length,
    },
  });

  return apiOk({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { ids: actorIds } = await getEffectivePermissions(asUserId(session.id));

  if (!canDeleteUsers(actorIds)) {
    return forbidden("Forbidden. Administrator permission required.", req);
  }

  const { id } = await params;

  if (id === session.id) {
    return badRequest("Cannot delete your own account.", req);
  }

  const { data: targetBeforeDelete } = await supabaseAdmin
    .from("profiles")
    .select("id, display_id, display_name, username")
    .eq("id", id)
    .maybeSingle();

  const targetSnapshot = targetBeforeDelete
    ? {
        id,
        label:
          (targetBeforeDelete as { display_name?: string | null }).display_name?.trim()
          || (
            (targetBeforeDelete as { username?: string | null }).username
              ? `@${(targetBeforeDelete as { username: string }).username}`
              : id
          ),
        username: (targetBeforeDelete as { username?: string | null }).username ?? null,
        displayName: (targetBeforeDelete as { display_name?: string | null }).display_name ?? null,
        displayId: (targetBeforeDelete as { display_id?: number | null }).display_id ?? null,
      } satisfies SecurityAuditSnapshot
    : { id, label: id } satisfies SecurityAuditSnapshot;

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) {
    console.error("[users/delete] auth admin error:", error.message);
    return internalError(req);
  }

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "user.delete",
    targetType: "user",
    targetId: id,
    targetSnapshot,
  });

  return apiOk({ ok: true });
}
