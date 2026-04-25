// app/api/chat/stream/route.ts
// GET /api/chat/stream?type=channel&id=<channelId>&since=<ISO>
// GET /api/chat/stream?type=dm&with=<userId>&since=<ISO>
//
// Events delivered:
//   connected  — stream open confirmation
//   msg        — new messages (INSERT on messages / direct_messages)
//   update     — edited messages (UPDATE on messages / direct_messages)
//   read       — DM read-receipt: { id } — message was marked read by recipient
//   typing     — typing indicators: Array<{ user_id, handle, updated_at }>
//   notif      — new @mention notification (INSERT on notifications for this user)
//
// Two-layer delivery:
//   Layer 1 — Supabase Realtime (postgres_changes) — ~50-150 ms
//   Layer 2 — Fallback DB poll every 3 s (also delivers typing list as snapshot)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest }        from "next/server";
import { getSession }         from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { isFounder }          from "@/lib/permissions";
import { asUserId }           from "@/lib/types/ids";
import { channelPerm }        from "@/lib/types/permission";
import { supabaseAdmin }      from "@/lib/supabase/server";
import { StreamParamsSchema } from "@/lib/validations/chat";

const POLL_MS      = 3_000;
const KA_MS        = 25_000;
const TYPING_TTL   = 5_000;   // rows older than this are considered stale
const FALLBACK_ISO = new Date(Date.now() - 10_000).toISOString();

const enc = new TextEncoder();

function encode(event: string, data: unknown): Uint8Array {
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function comment(text: string): Uint8Array {
  return enc.encode(`: ${text}\n\n`);
}

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const sessionId = session.id;

  // ── Param validation ───────────────────────────────────────
  const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed    = StreamParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.flatten() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const params = parsed.data;
  const since  = params.since ?? FALLBACK_ISO;

  // ── Permission check ───────────────────────────────────────
  if (params.type === "channel") {
    const [{ ids, flags }, channelRes] = await Promise.all([
      getEffectivePermissions(asUserId(sessionId)),
      supabaseAdmin.from("channels").select("public, view_permission").eq("id", params.id).single(),
    ]);
    const ch = channelRes.data as { public: boolean; view_permission: string | null } | null;
    const isPublic   = ch?.public === true;
    const viewPermId = ch?.view_permission ?? null;
    const canView =
      isFounder(ids) ||
      isPublic ||
      (viewPermId ? ids.includes(viewPermId) : flags.includes(channelPerm("view", params.id)));
    if (!canView) return new Response("Forbidden", { status: 403 });
  }

  // ── Shared state ───────────────────────────────────────────
  let closed     = false;
  let rtChannel: ReturnType<typeof supabaseAdmin.channel> | null = null;
  let pollTimer:  ReturnType<typeof setTimeout>            | null = null;

  function cleanup(): void {
    if (closed) return;
    closed = true;
    if (rtChannel) {
      supabaseAdmin.removeChannel(rtChannel).catch(() => {});
      rtChannel = null;
    }
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  req.signal.addEventListener("abort", cleanup);

  // ── SSE stream ─────────────────────────────────────────────
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encode("connected", { ts: Date.now() }));

      let lastTs = since;
      let kaTick = Date.now();

      function push(rows: unknown[]): void {
        if (closed || rows.length === 0) return;
        const last = (rows[rows.length - 1] as { created_at: string }).created_at;
        if (last > lastTs) lastTs = last;
        try { controller.enqueue(encode("msg", rows)); } catch { /* stream closed */ }
      }

      function pushUpdate(rows: unknown[]): void {
        if (closed || rows.length === 0) return;
        try { controller.enqueue(encode("update", rows)); } catch {}
      }

      function pushRead(id: string): void {
        if (closed) return;
        try { controller.enqueue(encode("read", { id })); } catch {}
      }

      function pushTyping(typers: unknown[]): void {
        if (closed) return;
        try { controller.enqueue(encode("typing", typers)); } catch {}
      }

      // ── Layer 1: Supabase Realtime ────────────────────────────────────────
      const chanId =
        `chat-${params.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const me   = sessionId;
      const them = params.type === "dm" ? params.with! : "";

      // Typing context: canonical sorted pair for DMs
      const typingCtx = params.type === "channel"
        ? `channel:${params.id}`
        : `dm:${[me, them].sort().join(":")}`;

      let builder = supabaseAdmin.channel(chanId);

      if (params.type === "channel") {
        builder = builder
          // New messages
          .on("postgres_changes", {
            event: "INSERT", schema: "public", table: "messages",
            filter: `channel_id=eq.${params.id}`,
          }, (payload) => push([payload.new]))
          // Edits
          .on("postgres_changes", {
            event: "UPDATE", schema: "public", table: "messages",
            filter: `channel_id=eq.${params.id}`,
          }, (payload) => pushUpdate([payload.new]));

      } else {
        builder = builder
          // New DMs
          .on("postgres_changes", {
            event: "INSERT", schema: "public", table: "direct_messages",
          }, (payload) => {
            const r = payload.new as { from_user_id: string; to_user_id: string };
            if (
              (r.from_user_id === me && r.to_user_id === them) ||
              (r.from_user_id === them && r.to_user_id === me)
            ) push([payload.new]);
          })
          // DM edits + read receipts
          .on("postgres_changes", {
            event: "UPDATE", schema: "public", table: "direct_messages",
          }, (payload) => {
            const n = payload.new as {
              id: string; from_user_id: string; to_user_id: string; read: boolean;
            };
            const o = payload.old as { read?: boolean } | undefined;
            if (
              !((n.from_user_id === me && n.to_user_id === them) ||
                (n.from_user_id === them && n.to_user_id === me))
            ) return;

            // Distinguish read-receipt flip from a body edit
            const becameRead = o?.read === false && n.read === true;
            if (becameRead) {
              pushRead(n.id);
            } else {
              pushUpdate([payload.new]);
            }
          });
      }

      // Typing indicators — shared for both stream types
      builder = builder.on("postgres_changes", {
        event: "*", schema: "public", table: "typing_indicators",
        filter: `context=eq.${typingCtx}`,
      }, (payload) => {
        const row = payload.new as { user_id: string; handle: string; updated_at: string };
        if (row.user_id === me) return;   // ignore own indicator
        const age = Date.now() - new Date(row.updated_at).getTime();
        if (age < TYPING_TTL) pushTyping([row]);
      });

      // @mention notifications for this user
      builder = builder.on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${me}`,
      }, (payload) => {
        if (closed) return;
        try { controller.enqueue(encode("notif", payload.new)); } catch {}
      });

      rtChannel = builder.subscribe();

      // ── Layer 2: Fallback DB poll ─────────────────────────────────────────
      async function poll(): Promise<void> {
        if (closed) return;

        try {
          // New messages
          if (params.type === "channel") {
            const { data } = await supabaseAdmin
              .from("messages")
              .select("id, channel_id, user_id, body, type, created_at, edited_at")
              .eq("channel_id", params.id)
              .gt("created_at", lastTs)
              .order("created_at", { ascending: true })
              .limit(50);
            push(data ?? []);

          } else {
            const { data } = await supabaseAdmin
              .from("direct_messages")
              .select("id, from_user_id, to_user_id, from_handle, to_handle, body, read, created_at, edited_at")
              .or(
                `and(from_user_id.eq.${sessionId},to_user_id.eq.${them}),` +
                `and(from_user_id.eq.${them},to_user_id.eq.${sessionId})`,
              )
              .gt("created_at", lastTs)
              .order("created_at", { ascending: true })
              .limit(50);
            push(data ?? []);
          }

          // Typing indicators snapshot (fallback when Realtime is unavailable)
          const cutoff = new Date(Date.now() - TYPING_TTL).toISOString();
          const { data: typers } = await supabaseAdmin
            .from("typing_indicators")
            .select("user_id, handle, updated_at")
            .eq("context", typingCtx)
            .neq("user_id", me)
            .gte("updated_at", cutoff);

          pushTyping(typers ?? []);

          // Keepalive
          if (!closed && Date.now() - kaTick > KA_MS) {
            try { controller.enqueue(comment("ka")); } catch {}
            kaTick = Date.now();
          }
        } catch {
          // DB error — don't crash the stream; next tick retries
        }

        if (!closed) pollTimer = setTimeout(poll, POLL_MS);
      }

      pollTimer = setTimeout(poll, POLL_MS);
    },

    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
