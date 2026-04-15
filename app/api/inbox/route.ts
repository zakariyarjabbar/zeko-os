// app/api/inbox/route.ts
// GET    /api/inbox          — list messages  (view-inbox | inbox-manager | Administrator)
// DELETE /api/inbox?id=uuid  — delete message (inbox-manager | Administrator)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { asUserId } from "@/lib/types/ids";
import { canViewInbox, canManageInbox } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const flags = await getEffectiveFlags(asUserId(session.id));
  if (!canViewInbox(flags)) {
    return NextResponse.json({ error: "Forbidden. view-inbox or inbox-manager permission required." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .select("id, name, email, subject, message, read, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const flags = await getEffectiveFlags(asUserId(session.id));
  if (!canManageInbox(flags)) {
    return NextResponse.json({ error: "Forbidden. inbox-manager permission required." }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("contact_messages")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
