// app/api/notifications/route.ts
// GET   /api/notifications          — list own notifications (newest first, max 50)
// PATCH /api/notifications          — mark notifications as read
//   body: { ids: string[] } | { all: true }

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { z }                         from "zod";

const MarkReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
  z.object({ all: z.literal(true) }),
]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, type, source_type, source_id, channel_id, from_handle, body, read, created_at")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const unread = rows.filter((r: { read: boolean }) => !r.read).length;

  return NextResponse.json({ notifications: rows, unread });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const parsed = MarkReadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide { ids: [...] } or { all: true }" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("user_id", session.id);

  if ("ids" in parsed.data) {
    query = query.in("id", parsed.data.ids);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
