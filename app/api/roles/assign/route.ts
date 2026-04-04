// app/api/roles/assign/route.ts
// POST /api/roles/assign
// Body: { userId, roleIds: string[] }
// Replaces all role assignments for the user atomically.
// Pass roleIds: [] to remove all roles.

import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/require-founder";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

  let body: { userId?: string; roleIds?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const { userId, roleIds } = body;
  if (!userId) return NextResponse.json({ error: "userId required." }, { status: 400 });

  const ids = Array.isArray(roleIds) ? roleIds : [];

  // Delete all existing assignments for this user
  const { error: delError } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  // Insert new assignments (skip if empty)
  if (ids.length > 0) {
    const rows = ids.map((roleId) => ({ user_id: userId, role_id: roleId }));
    const { error: insError } = await supabaseAdmin
      .from("user_roles")
      .insert(rows);

    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
