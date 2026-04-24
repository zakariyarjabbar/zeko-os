// app/api/chat/messages/route.ts
// GET    /api/chat/messages?channel=id  — fetch messages
// POST   /api/chat/messages             — send a message
// DELETE /api/chat/messages?id=uuid     — delete a message
//
// view/send: channels-manager (UUID) || has view:<channelId> (name, stable)
// delete:    own message || canDeleteChannelMessage

import { NextRequest, NextResponse }        from "next/server";
import { getSession }                        from "@/lib/auth";
import { supabaseAdmin }                     from "@/lib/supabase/server";
import { getEffectivePermissions }           from "@/lib/effective-flags";
import { asUserId }                          from "@/lib/types/ids";
import { SendChannelMessageSchema }          from "@/lib/validations/chat";
import { isChannelsManager, canDeleteChannelMessage } from "@/lib/permissions";

// ── GET ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = req.nextUrl.searchParams.get("channel");
  if (!channelId) return NextResponse.json({ error: "channel param required" }, { status: 400 });

  const [{ ids, flags }, channelRes] = await Promise.all([
    getEffectivePermissions(asUserId(session.id)),
    supabaseAdmin.from("channels").select("public, view_permission").eq("id", channelId).single(),
  ]);

  const ch = channelRes.data as { public: boolean; view_permission: string | null } | null;
  const isPublic = ch?.public === true;
  const viewPermId = ch?.view_permission ?? null;

  const canView =
    isChannelsManager(ids) ||
    isPublic ||
    (viewPermId ? ids.includes(viewPermId) : flags.includes(`view:${channelId}`));

  if (!canView) {
    return NextResponse.json({ error: "You do not have permission to view this channel." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, channel_id, user_id, body, type, created_at")
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

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const parsed = SendChannelMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }
  const { channelId, text } = parsed.data;

  const [{ ids, flags }, channelRes] = await Promise.all([
    getEffectivePermissions(asUserId(session.id)),
    supabaseAdmin.from("channels").select("public, view_permission").eq("id", channelId).single(),
  ]);

  const ch = channelRes.data as { public: boolean; view_permission: string | null } | null;
  const isPublic = ch?.public === true;
  const viewPermId = ch?.view_permission ?? null;

  const canSend =
    isChannelsManager(ids) ||
    isPublic ||
    (viewPermId ? ids.includes(viewPermId) : flags.includes(`view:${channelId}`));

  if (!canSend) {
    return NextResponse.json({ error: "You do not have permission to send messages in this channel." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      channel_id: channelId,
      user_id:    session.id,
      body:       text,
      type:       "message",
    })
    .select("id, channel_id, user_id, body, type, created_at")
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

  const m     = msg as { id: string; channel_id: string; user_id: string };
  const { ids, flags } = await getEffectivePermissions(asUserId(session.id));
  const isOwn = m.user_id === session.id;

  if (!canDeleteChannelMessage(ids, flags, m.channel_id, isOwn)) {
    return NextResponse.json({ error: "You do not have permission to delete this message." }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("messages").delete().eq("id", msgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
