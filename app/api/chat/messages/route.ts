// app/api/chat/messages/route.ts
// GET  /api/chat/messages?channel=global-ops  — fetch messages
// POST /api/chat/messages                     — send a message
// Uses admin client — bypasses RLS.
// Protected by session cookie check.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = req.nextUrl.searchParams.get("channel");
  if (!channelId) return NextResponse.json({ error: "channel param required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, channel_id, user_handle, body, type, created_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

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

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      channel_id:  channelId,
      user_id:     session.id,
      user_handle: session.name.toLowerCase(),
      body:        text.trim(),
      type:        "message",
    })
    .select("id, channel_id, user_handle, body, type, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
