// app/api/users/[id]/route.ts
// PATCH  /api/users/:id — update user  (moderator: limited fields | admin | Administrator)
// DELETE /api/users/:id — delete user  (admin | Administrator)
//
// Protection rules:
//  - moderator: can only edit MODERATOR_EDITABLE_FIELDS, blocked on Administrator-flagged targets
//  - admin: all fields, blocked on Administrator-flagged targets
//  - Administrator: all fields, no restrictions

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectiveFlags } from "@/lib/effective-flags";
import {
  canEditUsers, canDeleteUsers, isFounder,
  MODERATOR_EDITABLE_FIELDS,
} from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/server";

// Check if the target user holds the Administrator permission (via own flags OR roles)
async function targetIsAdministrator(targetId: string): Promise<boolean> {
  const flags = await getEffectiveFlags(targetId);
  return isFounder(flags);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorFlags = await getEffectiveFlags(session.id);

  if (!canEditUsers(actorFlags)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  // Administrator-protected target check (admin and moderator cannot touch them)
  if (!isFounder(actorFlags) && await targetIsAdministrator(id)) {
    return NextResponse.json(
      { error: "Forbidden. Cannot modify a user with Administrator permission." },
      { status: 403 }
    );
  }

  let body: {
    firstName?:   string;
    lastName?:    string;
    username?:    string;
    displayId?:   string;
    department?:  string;
    accessFlags?: string[];
    roleIds?:     string[];
    password?:    string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const isModerator = actorFlags.includes("moderator") && !actorFlags.includes("admin") && !isFounder(actorFlags);
  const isAdmin     = actorFlags.includes("admin") && !isFounder(actorFlags);

  // ── Profile fields ────────────────────────────────────────
  const profileUpdate: Record<string, unknown> = {};

  const fieldMap: Record<string, string> = {
    firstName:  "first_name",
    lastName:   "last_name",
    username:   "username",
    displayId:  "display_id",
    department: "department",
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    const val = body[key as keyof typeof body];
    if (val === undefined) continue;
    if (isModerator && !MODERATOR_EDITABLE_FIELDS.has(key)) continue; // blocked for moderator
    profileUpdate[col] = val;
  }

  // accessFlags — admin and Administrator only
  if (body.accessFlags !== undefined && !isModerator) {
    profileUpdate.access_flags = body.accessFlags;
  }

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Roles — admin and Administrator only ──────────────────
  if (body.roleIds !== undefined && !isModerator) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    if (body.roleIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert(body.roleIds.map((rid) => ({ user_id: id, role_id: rid })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // ── Password ──────────────────────────────────────────────
  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    // Moderators can change passwords, admins and admins too
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

  const actorFlags = await getEffectiveFlags(session.id);

  if (!canDeleteUsers(actorFlags)) {
    return NextResponse.json({ error: "Forbidden. admin or Administrator permission required." }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.id) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  // admin cannot delete Administrator-flagged users
  if (!isFounder(actorFlags) && await targetIsAdministrator(id)) {
    return NextResponse.json(
      { error: "Forbidden. Cannot delete a user with Administrator permission." },
      { status: 403 }
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
