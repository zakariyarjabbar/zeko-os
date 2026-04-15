// app/api/chat/stream/route.ts
// GET /api/chat/stream?type=channel&id=<channelId>&since=<ISO>
// GET /api/chat/stream?type=dm&with=<userId>&since=<ISO>
//
// Two-layer real-time delivery:
//
//   Layer 1 — Supabase Realtime (postgres_changes)
//     Delivers new rows the instant the DB commit is visible to the
//     replication slot — typically 50-150 ms end-to-end.
//     Requires "Realtime" to be enabled for each table in the Supabase
//     dashboard: Database → Replication → supabase_realtime publication.
//
//   Layer 2 — Fallback DB poll (every 3 s)
//     Queries only for rows newer than the last-seen timestamp.
//     When Realtime is working, that timestamp is already advanced by
//     the Realtime callback so the poll returns 0 rows (near-zero cost).
//     When Realtime is unavailable, this is the sole delivery mechanism
//     (≤ 3 s latency — the same as before, just a longer interval because
//     the Realtime layer handles the fast path).
//
// Security:
//   • Auth + permission checked BEFORE the stream starts — no re-checks
//     during the stream (same as before)
//   • Channel: requires view:<id> flag or Administrator
//   • DM:      participant identity enforced in both the Realtime callback
//              (server-side filter) and the fallback SQL query
//   • Supabase Realtime subscription uses the service-role key (server only)
//     — never exposed to the client
//   • All Realtime payloads are filtered server-side before being forwarded;
//     no extra data leaks out

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest }        from "next/server";
import { getSession }         from "@/lib/auth";
import { getEffectiveFlags }  from "@/lib/effective-flags";
import { supabaseAdmin }      from "@/lib/supabase/server";
import { StreamParamsSchema } from "@/lib/validations/chat";

const POLL_MS      = 3_000;   // fallback poll — Realtime handles the fast path
const KA_MS        = 25_000;  // keepalive interval (proxy timeout prevention)
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

  // ── Permission check (done once, before stream opens) ─────
  if (params.type === "channel") {
    const flags   = await getEffectiveFlags(session.id);
    const isAdmin = flags.includes("Administrator");
    if (!isAdmin && !flags.includes(`view:${params.id}`)) {
      return new Response("Forbidden", { status: 403 });
    }
  }
  // DM: participant identity is enforced in the Realtime callback filter
  // and in the fallback SQL .or() query below

  // ── Shared state ───────────────────────────────────────────
  let closed     = false;
  let rtChannel: ReturnType<typeof supabaseAdmin.channel> | null = null;
  let pollTimer:  ReturnType<typeof setTimeout>            | null = null;

  /** Single teardown path — called on abort AND on ReadableStream cancel. */
  function cleanup(): void {
    if (closed) return;
    closed = true;
    if (rtChannel) {
      supabaseAdmin.removeChannel(rtChannel).catch(() => {/* best-effort */});
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

      /**
       * Push rows to the client.
       * Updates `lastTs` so the fallback poll never re-delivers rows that
       * Realtime already delivered.
       */
      function push(rows: unknown[]): void {
        if (closed || rows.length === 0) return;
        const last = (rows[rows.length - 1] as { created_at: string }).created_at;
        if (last > lastTs) lastTs = last;
        try {
          controller.enqueue(encode("msg", rows));
        } catch {
          // Controller already closed — suppress the error
        }
      }

      // ── Layer 1: Supabase Realtime ────────────────────────────────────────
      // Fires the callback the moment the DB commit is replicated.
      // Unique channel name prevents subscription conflicts across concurrent
      // connections from different users / browser tabs.
      const chanId =
        `chat-${params.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (params.type === "channel") {
        rtChannel = supabaseAdmin
          .channel(chanId)
          .on(
            "postgres_changes",
            {
              event:  "INSERT",
              schema: "public",
              table:  "messages",
              filter: `channel_id=eq.${params.id}`,   // server-side pre-filter
            },
            (payload) => push([payload.new]),
          )
          .subscribe();

      } else {
        // DM — Realtime filter only supports single-column eq, so we filter
        // both directions in the callback.  The callback runs server-side and
        // only forwards rows that belong to THIS conversation.
        const me   = session.id;
        const them = params.with!;

        rtChannel = supabaseAdmin
          .channel(chanId)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "direct_messages" },
            (payload) => {
              const r = payload.new as { from_user_id: string; to_user_id: string };
              if (
                (r.from_user_id === me   && r.to_user_id === them) ||
                (r.from_user_id === them && r.to_user_id === me)
              ) {
                push([payload.new]);
              }
            },
          )
          .subscribe();
      }

      // ── Layer 2: Fallback DB poll ─────────────────────────────────────────
      // Runs every 3 s.  When Realtime is delivering messages, `lastTs` is
      // already advanced, so the query returns 0 rows for near-zero cost.
      // When Realtime is unavailable (table not in replication slot, or a
      // brief reconnect window), this is the sole delivery mechanism.
      async function poll(): Promise<void> {
        if (closed) return;

        try {
          let newRows: unknown[] = [];

          if (params.type === "channel") {
            const { data } = await supabaseAdmin
              .from("messages")
              .select("id, channel_id, user_id, body, type, created_at")
              .eq("channel_id", params.id)
              .gt("created_at", lastTs)
              .order("created_at", { ascending: true })
              .limit(50);
            newRows = data ?? [];

          } else {
            const { data } = await supabaseAdmin
              .from("direct_messages")
              .select("id, from_user_id, to_user_id, from_handle, to_handle, body, read, created_at")
              .or(
                `and(from_user_id.eq.${session.id},to_user_id.eq.${params.with}),` +
                `and(from_user_id.eq.${params.with},to_user_id.eq.${session.id})`,
              )
              .gt("created_at", lastTs)
              .order("created_at", { ascending: true })
              .limit(50);
            newRows = data ?? [];
          }

          push(newRows);

          // Keepalive comment — prevents proxy / load-balancer timeouts
          if (!closed && Date.now() - kaTick > KA_MS) {
            try { controller.enqueue(comment("ka")); } catch { /* stream closed */ }
            kaTick = Date.now();
          }
        } catch {
          // DB error — don't crash the stream; next tick retries
        }

        if (!closed) pollTimer = setTimeout(poll, POLL_MS);
      }

      // Start the fallback poll after one interval so the client's initial
      // message load can finish before we start pushing new rows.
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
      "X-Accel-Buffering": "no",   // disable nginx / Vercel edge buffering
    },
  });
}
