// app/api/admin/permissions/route.ts
// GET /api/admin/permissions — returns all permission definitions (Administrator only)

import { NextResponse } from "next/server";
import { getSession }              from "@/lib/auth";
import { supabaseAdmin }           from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { isFounder }               from "@/lib/permissions";
import { asUserId }                from "@/lib/types/ids";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("permissions")
    .select("id, name, description")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
