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

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { asUserId } from "@/lib/types/ids";
import {
  canEditAnyUser, canChangeDisplayName, canManagePermissions,
  canManageRoles, canDeleteUsers, isFounder,
} from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";

async function targetIsAdministrator(targetId: string): Promise<boolean> {
  const { ids } = await getEffectivePermissions(asUserId(targetId));
  return isFounder(ids);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids: actorIds } = await getEffectivePermissions(asUserId(session.id));

  if (!canEditAnyUser(actorIds)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  // Non-Administrator actors cannot modify an Administrator-flagged user
  if (!isFounder(actorIds) && await targetIsAdministrator(id)) {
    return NextResponse.json(
      { error: "Forbidden. Cannot modify a user with Administrator permission." },
      { status: 403 }
    );
  }

  let body: {
    username?:     string;
    displayName?:  string;
    accessFlags?:  string[];
    roleIds?:      string[];
    password?:     string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  // ── Profile fields ────────────────────────────────────────────
  const profileUpdate: Record<string, unknown> = {};

  if (canChangeDisplayName(actorIds)) {
    if (body.username !== undefined) {
      profileUpdate.username = body.username;
    }
    if (body.displayName !== undefined) {
      const dn = body.displayName.trim();
      if ((dn.match(/ /g) ?? []).length > 1) {
        return NextResponse.json({ error: "Display name may contain at most one space." }, { status: 400 });
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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Roles ─────────────────────────────────────────────────────
  if (body.roleIds !== undefined && canManageRoles(actorIds)) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    if (body.roleIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert(body.roleIds.map((rid) => ({ user_id: id, role_id: rid })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // ── Password ──────────────────────────────────────────────────
  if (body.password && canChangeDisplayName(actorIds)) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids: actorIds } = await getEffectivePermissions(asUserId(session.id));

  if (!canDeleteUsers(actorIds)) {
    return NextResponse.json({ error: "Forbidden. Administrator permission required." }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.id) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
