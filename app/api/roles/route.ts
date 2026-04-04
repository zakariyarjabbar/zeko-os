// app/api/roles/route.ts
// GET  /api/roles — list all roles with user counts
// POST /api/roles — create a new role
// Both require ROOT_ACCESS.

import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/require-founder";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

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
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

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
