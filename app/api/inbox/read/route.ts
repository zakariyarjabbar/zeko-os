// app/api/inbox/read/route.ts
// PATCH /api/inbox/read?id=uuid — mark a message as read.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { canViewInbox } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const flags = await getEffectiveFlags(asUserId(session.id));
  if (!canViewInbox(flags)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("contact_messages")
    .update({ read: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
