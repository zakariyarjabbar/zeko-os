// app/api/chat/edits/route.ts
// GET /api/chat/edits?messageId=<uuid>
//
// Returns the edit history for a message. Any authenticated user can read
// (so moderators/admins can audit changes). The RLS policy on message_edits
// enforces this at the DB level as well.

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messageId = req.nextUrl.searchParams.get("messageId");
  if (!messageId) {
    return NextResponse.json({ error: "messageId param required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("message_edits")
    .select("id, old_body, new_body, edited_at")
    .eq("message_id", messageId)
    .order("edited_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
