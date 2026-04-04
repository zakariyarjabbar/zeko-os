// app/api/users/[id]/route.ts
// PATCH  /api/users/:id — update profile fields + roles
// DELETE /api/users/:id — delete user
// Both require Administrator.

import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/require-founder";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

  const { id } = await params;

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

  // ── Profile fields ────────────────────────────────────────
  const profileUpdate: Record<string, unknown> = {};
  if (body.firstName   !== undefined) profileUpdate.first_name    = body.firstName;
  if (body.lastName    !== undefined) profileUpdate.last_name      = body.lastName;
  if (body.username    !== undefined) profileUpdate.username       = body.username;
  if (body.displayId   !== undefined) profileUpdate.display_id    = body.displayId;
  if (body.department  !== undefined) profileUpdate.department     = body.department;
  if (body.accessFlags !== undefined) profileUpdate.access_flags  = body.accessFlags;

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Roles — replace all assignments atomically ────────────
  if (body.roleIds !== undefined) {
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
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

  const { id } = await params;

  if (id === guard.sessionId) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
