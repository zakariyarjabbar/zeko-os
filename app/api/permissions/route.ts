// app/api/permissions/route.ts
// GET  /api/permissions — list all permissions
// POST /api/permissions — create a permission
// Both require Administrator.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { canManagePermissions, isFounder } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logSecurityAuditEvent } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManagePermissions(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("permissions")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManagePermissions(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string; description?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const { name, description } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("permissions")
    .insert({ name: name.trim(), description: description?.trim() ?? "" })
    .select("id, name, description, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A permission with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "permission.create",
    targetType: "permission",
    targetId: data.id as string,
    targetSnapshot: {
      id: data.id as string,
      label: data.name as string,
      name: data.name as string,
    },
    metadata: {
      name: data.name,
    },
  });

  return NextResponse.json(data);
}
