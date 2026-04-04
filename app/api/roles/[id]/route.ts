// app/api/roles/[id]/route.ts
// GET    /api/roles/:id         — get role + assigned users
// PATCH  /api/roles/:id         — update role
// DELETE /api/roles/:id         — delete role
// All require ROOT_ACCESS.

import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/require-founder";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

  const { id } = await params;

  const { data: role, error } = await supabaseAdmin
    .from("roles")
    .select("id, name, description, permissions, created_at")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Get assigned users via junction table
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, profiles(id, display_id, username, first_name, last_name, session_status)")
    .eq("role_id", id);

  const users = (userRoles ?? [])
    .map((ur: { user_id: string; profiles: unknown }) => ur.profiles)
    .filter(Boolean);

  return NextResponse.json({ ...role, users });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

  const { id } = await params;

  let body: { name?: string; description?: string; permissions?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (body.name        !== undefined) update.name        = body.name.trim();
  if (body.description !== undefined) update.description = body.description.trim();
  if (body.permissions !== undefined) update.permissions = body.permissions;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("roles")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

  const { id } = await params;

  // Unassign all users (cascade handles it but be explicit)
  await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("role_id", id);

  const { error } = await supabaseAdmin
    .from("roles")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
