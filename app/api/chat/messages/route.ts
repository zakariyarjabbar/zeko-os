// app/api/chat/messages/route.ts
// GET    /api/chat/messages?channel=id  — fetch messages
// POST   /api/chat/messages             — send a message (+ fires @mention notifications)
// PATCH  /api/chat/messages             — edit own message
// DELETE /api/chat/messages?id=uuid     — delete a message
//
// view/send: channels-manager (UUID) || has view:<channelId> (name, stable)
// delete:    own message || canDeleteChannelMessage
// edit:      own message only

import { NextRequest, NextResponse }        from "next/server";
import { getSession }                        from "@/lib/auth";
import { supabaseAdmin }                     from "@/lib/supabase/server";
import { getEffectivePermissions }           from "@/lib/effective-flags";
import { asUserId }                          from "@/lib/types/ids";
import { SendChannelMessageSchema }          from "@/lib/validations/chat";
import { isChannelsManager, canDeleteChannelMessage } from "@/lib/permissions";
import { logSecurityAuditEvent }             from "@/lib/audit";
import { z }                                 from "zod";

// ── Shared helpers ─────────────────────────────────────────────

const MENTION_RE = /@([a-z][a-z0-9_-]{0,29})/gi;

async function fireMentionNotifications(
  text:      string,
  messageId: string,
  channelId: string,
  senderId:  string,
  senderHandle: string,
) {
  const matches = [...text.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase());
  const unique  = [...new Set(matches)];
  if (unique.length === 0) return;

  const { data: mentioned } = await supabaseAdmin
    .from("profiles")
    .select("id, username")
    .in("username", unique);

  const recipients = (mentioned ?? []).filter(
    (p: { id: string }) => p.id !== senderId,
  );
  if (recipients.length === 0) return;

  await supabaseAdmin.from("notifications").insert(
    recipients.map((p: { id: string }) => ({
      user_id:      p.id,
      type:         "mention",
      source_type:  "channel",
      source_id:    messageId,
      channel_id:   channelId,
      from_user_id: senderId,
      from_handle:  senderHandle,
      body:         text.slice(0, 200),
    })),
  );
}

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

  // Fire @mention notifications in the background (non-blocking)
  const senderHandle = (session.name ?? "unknown").toLowerCase();
  fireMentionNotifications(text, data.id, channelId, session.id, senderHandle).catch(() => {});

  return NextResponse.json(data);
}

// ── PATCH ──────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const parsed = z.object({
    id:   z.string().uuid("Invalid message id."),
    text: z.string().min(1).max(4000),
  }).safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }
  const { id: msgId, text: newBody } = parsed.data;

  const { data: msg } = await supabaseAdmin
    .from("messages")
    .select("id, channel_id, user_id, body")
    .eq("id", msgId)
    .single();

  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  const m = msg as { id: string; channel_id: string; user_id: string; body: string };
  if (m.user_id !== session.id) {
    return NextResponse.json({ error: "You can only edit your own messages." }, { status: 403 });
  }

  // Record the previous version in the audit log
  await supabaseAdmin.from("message_edits").insert({
    message_id: msgId,
    source:     "channel",
    old_body:   m.body,
    new_body:   newBody,
    edited_by:  session.id,
  });

  const { data: updated, error } = await supabaseAdmin
    .from("messages")
    .update({ body: newBody, edited_at: new Date().toISOString() })
    .eq("id", msgId)
    .select("id, channel_id, user_id, body, type, created_at, edited_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(updated);
}

// ── DELETE ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const msgId = req.nextUrl.searchParams.get("id");
  if (!msgId) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const { data: msg } = await supabaseAdmin
    .from("messages")
    .select("id, channel_id, user_id, body, type, created_at")
    .eq("id", msgId)
    .single();

  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  const m = msg as {
    id: string;
    channel_id: string;
    user_id: string;
    body: string | null;
    type: string | null;
    created_at: string | null;
  };
  const { ids, flags } = await getEffectivePermissions(asUserId(session.id));
  const isOwn = m.user_id === session.id;

  if (!canDeleteChannelMessage(ids, flags, m.channel_id, isOwn)) {
    return NextResponse.json({ error: "You do not have permission to delete this message." }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("messages").delete().eq("id", msgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "message.delete",
    targetType: "message",
    targetId: msgId,
    severity: isOwn ? "low" : "medium",
    metadata: {
      channelId: m.channel_id,
      ownerUserId: m.user_id,
      isOwn,
      type: m.type,
      bodyPreview: (m.body ?? "").slice(0, 120),
    },
    targetSnapshot: {
      id: msgId,
      label: `message:${msgId}`,
      channelId: m.channel_id,
      ownerUserId: m.user_id,
    },
    diff: { deleted: { before: true, after: false } },
  });

  return NextResponse.json({ ok: true });
}
