// app/api/chat/messages/route.ts
// GET    /api/chat/messages?channel=id  — fetch messages
// POST   /api/chat/messages             — send a message
// DELETE /api/chat/messages?id=uuid     — delete a message
//
// Permission model:
//   view:    user needs "view:<channelId>"    in access_flags  (or Administrator)
//   send:    authenticated = can send (no extra perm needed)
//   delete:  user needs "delete-msg:<channelId>" in access_flags (or Administrator)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

async function getUserFlags(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("access_flags")
    .eq("id", userId)
    .single();
  return (data as { access_flags: string[] } | null)?.access_flags ?? [];
}

function isAdmin(flags: string[]): boolean {
  return flags.includes("Administrator");
}

// ── GET ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = req.nextUrl.searchParams.get("channel");
  if (!channelId) return NextResponse.json({ error: "channel param required" }, { status: 400 });

  const flags = await getUserFlags(session.id);

  if (!isAdmin(flags) && !flags.includes(`view:${channelId}`)) {
    return NextResponse.json({ error: "You do not have permission to view this channel." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, channel_id, user_id, user_handle, body, type, created_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

// ── POST ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { channelId?: string; text?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const { channelId, text } = body;
  if (!channelId || !text?.trim()) {
    return NextResponse.json({ error: "channelId and text required" }, { status: 400 });
  }

  // Must be able to view the channel to send in it
  const flags = await getUserFlags(session.id);
  if (!isAdmin(flags) && !flags.includes(`view:${channelId}`)) {
    return NextResponse.json({ error: "You do not have permission to send messages in this channel." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      channel_id:  channelId,
      user_id:     session.id,
      user_handle: session.name.toLowerCase(),
      body:        text.trim(),
      type:        "message",
    })
    .select("id, channel_id, user_id, user_handle, body, type, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// ── DELETE ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const msgId = req.nextUrl.searchParams.get("id");
  if (!msgId) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const { data: msg } = await supabaseAdmin
    .from("messages")
    .select("id, channel_id, user_id")
    .eq("id", msgId)
    .single();

  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  const m = msg as { id: string; channel_id: string; user_id: string };
  const flags = await getUserFlags(session.id);
  const isOwn = m.user_id === session.id;
  const canDelete = isOwn || isAdmin(flags) || flags.includes(`delete-msg:${m.channel_id}`);

  if (!canDelete) {
    return NextResponse.json({ error: "You do not have permission to delete this message." }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("messages").delete().eq("id", msgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
