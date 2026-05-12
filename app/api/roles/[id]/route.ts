// app/api/roles/[id]/route.ts
// GET    /api/roles/:id  — role detail + assigned users
// PATCH  /api/roles/:id  — update role
// DELETE /api/roles/:id  — delete role
// All require Administrator.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { canManageRoles, isFounder } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logSecurityAuditEvent, type SecurityAuditDiff, type SecurityAuditSnapshot } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManageRoles(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const { data: role, error } = await supabaseAdmin
    .from("roles")
    .select("id, name, description, permissions, created_at")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // ── Get assigned users ─────────────────────────────────────
  // user_roles FK points to auth.users, not profiles — do two queries.
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role_id", id);

  const userIds = (userRoles ?? []).map((ur: { user_id: string }) => ur.user_id);

  let users: unknown[] = [];
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_id, username, session_status")
      .in("id", userIds);
    users = profiles ?? [];
  }

  // ── Sanitise permissions ───────────────────────────────────
  // Only keep permission IDs that exist in the permissions table.
  const { data: validPerms } = await supabaseAdmin
    .from("permissions")
    .select("id");

  const validIds = new Set((validPerms ?? []).map((p: { id: string }) => p.id));
  const r = role as { id: string; name: string; description: string; permissions: string[]; created_at: string };
  const cleanPermissions = (r.permissions ?? []).filter((p) => validIds.has(p));

  return NextResponse.json({ ...r, permissions: cleanPermissions, users });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManageRoles(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: { name?: string; description?: string; permissions?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const { data: beforeRole } = await supabaseAdmin
    .from("roles")
    .select("id, name, description, permissions")
    .eq("id", id)
    .maybeSingle();

  const before = beforeRole as {
    id: string;
    name: string | null;
    description: string | null;
    permissions: string[] | null;
  } | null;

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

  const diff: SecurityAuditDiff = {};
  if (body.name !== undefined) {
    diff.name = { before: before?.name ?? null, after: body.name.trim() };
  }
  if (body.description !== undefined) {
    diff.description = { before: before?.description ?? null, after: body.description.trim() };
  }
  if (body.permissions !== undefined) {
    diff.permissions = { before: before?.permissions ?? [], after: body.permissions };
  }

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "role.update",
    targetType: "role",
    targetId: id,
    diff,
    metadata: {
      changedFields: Object.keys(update),
      permissionsCount: body.permissions?.length,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManageRoles(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const { data: beforeRole } = await supabaseAdmin
    .from("roles")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  const targetSnapshot = beforeRole
    ? {
        id,
        label: (beforeRole as { name?: string | null }).name ?? id,
        name: (beforeRole as { name?: string | null }).name ?? null,
      } satisfies SecurityAuditSnapshot
    : { id, label: id } satisfies SecurityAuditSnapshot;

  await supabaseAdmin.from("user_roles").delete().eq("role_id", id);

  const { error } = await supabaseAdmin.from("roles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "role.delete",
    targetType: "role",
    targetId: id,
    targetSnapshot,
  });

  return NextResponse.json({ ok: true });
}
