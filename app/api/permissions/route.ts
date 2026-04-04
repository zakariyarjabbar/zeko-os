// app/api/permissions/route.ts
// GET  /api/permissions — list all permissions
// POST /api/permissions — create a permission
// Both require Administrator.

import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/require-founder";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

  const { data, error } = await supabaseAdmin
    .from("permissions")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const guard = await requireFounder();
  if (!guard.ok) return guard.error as unknown as NextResponse;

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

  return NextResponse.json(data);
}
