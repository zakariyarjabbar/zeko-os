// app/api/chat/dm/route.ts
// GET    /api/chat/dm?with=userId  — fetch DM thread between current user and target
// POST   /api/chat/dm              — send a DM
// PATCH  /api/chat/dm              — edit own DM (sender only)
// DELETE /api/chat/dm?id=uuid      — delete own DM (sender only)
// GET    /api/chat/dm?conversations=1 — list all DM conversations

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { SendDMSchema }              from "@/lib/validations/chat";
import { z }                         from "zod";

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

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const parsed = SendDMSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }
  const { toUserId, text } = parsed.data;

  // Fetch both sender and recipient profiles in parallel
  const [{ data: fromProfile }, { data: toProfile }] = await Promise.all([
    supabaseAdmin.from("profiles").select("display_name, username").eq("id", session.id).single(),
    supabaseAdmin.from("profiles").select("display_name, username").eq("id", toUserId).single(),
  ]);

  type ProfileRow = { display_name: string; username: string } | null;
  const fp = fromProfile as ProfileRow;
  const tp = toProfile   as ProfileRow;

  // Use display_name as the handle; fall back to username, then session.name
  const fromHandle = (fp?.display_name?.trim() || fp?.username || session.name).toLowerCase();
  const toHandle   = (tp?.display_name?.trim() || tp?.username || "unknown").toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("direct_messages")
    .insert({
      from_user_id: session.id,
      to_user_id:   toUserId,
      from_handle:  fromHandle,
      to_handle:    toHandle,
      body:         text,   // already trimmed + sanitized by Zod transform
      read:         false,
    })
    .select("id, from_user_id, to_user_id, from_handle, to_handle, body, read, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

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
    .from("direct_messages")
    .select("id, from_user_id, body")
    .eq("id", msgId)
    .single();

  const m = msg as { id: string; from_user_id: string; body: string } | null;
  if (!m) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  if (m.from_user_id !== session.id) {
    return NextResponse.json({ error: "You can only edit your own messages." }, { status: 403 });
  }

  await supabaseAdmin.from("message_edits").insert({
    message_id: msgId,
    source:     "dm",
    old_body:   m.body,
    new_body:   newBody,
    edited_by:  session.id,
  });

  const { data: updated, error } = await supabaseAdmin
    .from("direct_messages")
    .update({ body: newBody, edited_at: new Date().toISOString() })
    .eq("id", msgId)
    .select("id, from_user_id, to_user_id, from_handle, to_handle, body, read, created_at, edited_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const msgId = req.nextUrl.searchParams.get("id");
  if (!msgId) return NextResponse.json({ error: "id param required" }, { status: 400 });

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
