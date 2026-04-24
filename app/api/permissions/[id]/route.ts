// app/api/permissions/[id]/route.ts
// PATCH  /api/permissions/:id — update name/description
// DELETE /api/permissions/:id — delete permission
// Both require Administrator.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { canManagePermissions, isFounder } from "@/lib/permissions";

const ADMIN_PERMISSION = "Administrator";
import { asUserId } from "@/lib/types/ids";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManagePermissions(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: { name?: string; description?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const update: Record<string, string> = {};
  if (body.name        !== undefined) update.name        = body.name.trim();
  if (body.description !== undefined) update.description = body.description.trim();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("permissions")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManagePermissions(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Protect Administrator from deletion
  const { data } = await supabaseAdmin
    .from("permissions")
    .select("name")
    .eq("id", id)
    .single();

  if ((data as { name: string } | null)?.name === ADMIN_PERMISSION) {
    return NextResponse.json({ error: "Administrator permission cannot be deleted." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("permissions")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
