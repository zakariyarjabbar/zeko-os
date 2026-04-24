// app/api/roles/route.ts
// GET  /api/roles — list all roles with user counts
// POST /api/roles — create a new role
// Both require ROOT_ACCESS.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { canManageRoles, isFounder } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManageRoles(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: roles, error } = await supabaseAdmin
    .from("roles")
    .select("id, name, description, permissions, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count users per role via junction table
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role_id");

  const counts: Record<string, number> = {};
  (userRoles ?? []).forEach((ur: { role_id: string }) => {
    counts[ur.role_id] = (counts[ur.role_id] ?? 0) + 1;
  });

  const result = (roles ?? []).map((r) => ({
    ...r,
    userCount: counts[r.id] ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManageRoles(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string; description?: string; permissions?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const { name, description, permissions } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("roles")
    .insert({
      name:        name.trim(),
      description: description?.trim() ?? "",
      permissions: permissions ?? [],
    })
    .select("id, name, description, permissions, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A role with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
