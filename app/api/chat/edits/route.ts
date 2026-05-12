// app/api/chat/edits/route.ts
// GET /api/chat/edits?messageId=<uuid>
//
// Returns the edit history for a message. Any authenticated user can read
// (so moderators/admins can audit changes). The RLS policy on message_edits
// enforces this at the DB level as well.

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { z }                         from "zod";

const MessageIdSchema = z.string().uuid("Invalid message id.");

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = MessageIdSchema.safeParse(req.nextUrl.searchParams.get("messageId") ?? "");
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message id." }, { status: 400 });
  const messageId = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("message_edits")
    .select("id, old_body, new_body, edited_at")
    .eq("message_id", messageId)
    .order("edited_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
