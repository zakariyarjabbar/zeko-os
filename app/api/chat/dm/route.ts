// app/api/chat/dm/route.ts
// GET  /api/chat/dm?with=userId  — fetch DM thread between current user and target
// POST /api/chat/dm              — send a DM
// GET  /api/chat/dm/conversations — list all DM conversations (via ?conversations=1)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // List all DM conversations
  if (req.nextUrl.searchParams.get("conversations") === "1") {
    const { data } = await supabaseAdmin
      .from("direct_messages")
      .select("id, from_user_id, to_user_id, from_handle, to_handle, body, read, created_at")
      .or(`from_user_id.eq.${session.id},to_user_id.eq.${session.id}`)
      .order("created_at", { ascending: false });

    // Build conversation list — one entry per unique partner
    const seen = new Map<string, {
      userId: string; handle: string; unread: number; lastMsg: string; lastTime: string;
    }>();

    (data ?? []).forEach((m: {
      from_user_id: string; to_user_id: string;
      from_handle: string; to_handle: string;
      body: string; read: boolean; created_at: string;
    }) => {
      const partnerId   = m.from_user_id === session.id ? m.to_user_id   : m.from_user_id;
      const partnerHandle = m.from_user_id === session.id ? m.to_handle : m.from_handle;
      const isUnread    = !m.read && m.to_user_id === session.id;

      if (!seen.has(partnerId)) {
        seen.set(partnerId, {
          userId:   partnerId,
          handle:   partnerHandle,
          unread:   isUnread ? 1 : 0,
          lastMsg:  m.body,
          lastTime: m.created_at,
        });
      } else if (isUnread) {
        seen.get(partnerId)!.unread++;
      }
    });

    return NextResponse.json([...seen.values()]);
  }

  // Fetch DM thread with a specific user
  const withUser = req.nextUrl.searchParams.get("with");
  if (!withUser) return NextResponse.json({ error: "with param required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("direct_messages")
    .select("id, from_user_id, to_user_id, from_handle, to_handle, body, read, created_at")
    .or(
      `and(from_user_id.eq.${session.id},to_user_id.eq.${withUser}),and(from_user_id.eq.${withUser},to_user_id.eq.${session.id})`
    )
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark unread messages as read
  await supabaseAdmin
    .from("direct_messages")
    .update({ read: true })
    .eq("to_user_id", session.id)
    .eq("from_user_id", withUser)
    .eq("read", false);

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { toUserId?: string; text?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const { toUserId, text } = body;
  if (!toUserId || !text?.trim()) {
    return NextResponse.json({ error: "toUserId and text required" }, { status: 400 });
  }

  // Get recipient handle
  const { data: toProfile } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", toUserId)
    .single();

  const toHandle = (toProfile as { username: string } | null)?.username ?? "unknown";

  const { data, error } = await supabaseAdmin
    .from("direct_messages")
    .insert({
      from_user_id: session.id,
      to_user_id:   toUserId,
      from_handle:  session.name.toLowerCase(),
      to_handle:    toHandle,
      body:         text.trim(),
      read:         false,
    })
    .select("id, from_user_id, to_user_id, from_handle, to_handle, body, read, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const msgId = req.nextUrl.searchParams.get("id");
  if (!msgId) return NextResponse.json({ error: "id param required" }, { status: 400 });

  // Only sender can delete their own DM
  const { data: msg } = await supabaseAdmin
    .from("direct_messages")
    .select("from_user_id")
    .eq("id", msgId)
    .single();

  const m = msg as { from_user_id: string } | null;
  if (!m) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  if (m.from_user_id !== session.id) {
    return NextResponse.json({ error: "You can only delete your own messages." }, { status: 403 });
  }

  await supabaseAdmin.from("direct_messages").delete().eq("id", msgId);

  return NextResponse.json({ ok: true });
}
