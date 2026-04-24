// app/api/stream/events/route.ts
// GET /api/stream/events?watch=id1,id2,...
//
// Global shell-level Server-Sent Events stream.
// Notifies the client when structural data changes and pushes presence
// updates for a watched set of user IDs — replacing all client-side
// presence polling.
//
// Events emitted:
//   event: dm        — a new unread DM arrived for the current user
//   event: inbox     — a new contact_message arrived (inbox-access only)
//   event: presence  — data: {"userId":"...","status":"ONLINE"|"OFFLINE"}
//                      pushed only when a watched user's status changes
//   : keepalive      — comment every 25 s to prevent proxy timeouts
//
// Security:
//   • Auth required at connection time — 401 if no session
//   • Permission snapshot taken once at connection — inbox check is permanent
//   • watch IDs are validated as UUIDs and capped at 50 — no injection possible
//   • Presence (online/offline) is non-sensitive; any authenticated user can
//     already query it via GET /api/presence
//   • No message content, no profile data, no secrets ever leave this stream

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest }       from "next/server";
import { getSession }        from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { asUserId }          from "@/lib/types/ids";
import { supabaseAdmin }     from "@/lib/supabase/server";
import { canViewInbox }      from "@/lib/permissions";

const POLL_MS           = 3_000;   // check DB every 3 s
const PRESENCE_POLL_MS  = 3_000;   // same cadence — batched with main poll
const KA_MS             = 25_000;  // keepalive every 25 s
const ONLINE_THRESHOLD  = 25_000;  // must match presence/route.ts

// ── UUID guard ────────────────────────────────────────────────────────────────
// Prevents any non-UUID string from reaching the DB query.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(s: string): boolean { return UUID_RE.test(s); }

// ── SSE helpers ───────────────────────────────────────────────────────────────

const enc = new TextEncoder();

function comment(text: string): Uint8Array {
  return enc.encode(`: ${text}\n\n`);
}

/** Signal-only event — client fetches the actual data. */
function signal(name: string): Uint8Array {
  return enc.encode(`event: ${name}\ndata: 1\n\n`);
}

/** Event with a JSON payload. */
function eventData(name: string, payload: unknown): Uint8Array {
  return enc.encode(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const sessionId = session.id; // extract before async closures (strict null safety)

  // ── Permission snapshot (taken once at connection time) ────
  const { ids: initIds } = await getEffectivePermissions(asUserId(sessionId));
  const watchInbox       = canViewInbox(initIds);
  // Snapshot hashed from UUIDs — detects any permission change on each poll.
  let flagsSnapshot = [...initIds].sort().join(",");

  // ── Presence watch list ────────────────────────────────────
  // Parse ?watch=uuid1,uuid2,...  Validate every entry as a UUID
  // and cap at 50 to prevent resource exhaustion.
  const rawWatch  = req.nextUrl.searchParams.get("watch") ?? "";
  const watchIds  = rawWatch
    .split(",")
    .map((s) => s.trim())
    .filter(isUUID)
    .slice(0, 50);

  // ── Stream ─────────────────────────────────────────────────
  let closed = false;
  req.signal.addEventListener("abort", () => { closed = true; });

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(comment("connected"));

      const sinceConnect = new Date().toISOString();
      let dmSince    = sinceConnect;
      let inboxSince = sinceConnect;
      let kaTick     = Date.now();

      // ── Presence snapshot ──────────────────────────────────
      // Tracks the last-known status for each watched user so we only
      // emit when something actually changes.
      const presenceSnapshot: Record<string, "ONLINE" | "OFFLINE"> = {};
      // Seed snapshot with OFFLINE — the first poll will push ONLINE
      // events for anyone already online, giving the client an accurate
      // picture within the first 3 s without a separate REST call.
      for (const id of watchIds) presenceSnapshot[id] = "OFFLINE";

      async function poll() {
        if (closed) return;

        try {
          // ── New unread DMs for this user ──────────────────────
          const { data: dmRows } = await supabaseAdmin
            .from("direct_messages")
            .select("id, created_at")
            .eq("to_user_id", sessionId)
            .eq("read", false)
            .gt("created_at", dmSince)
            .order("created_at", { ascending: false })
            .limit(1);

          if (!closed && dmRows && dmRows.length > 0) {
            dmSince = (dmRows[0] as { created_at: string }).created_at;
            controller.enqueue(signal("dm"));
          }

          // ── New inbox messages (inbox-access only) ────────────
          if (watchInbox) {
            const { data: inboxRows } = await supabaseAdmin
              .from("contact_messages")
              .select("id, created_at")
              .gt("created_at", inboxSince)
              .order("created_at", { ascending: false })
              .limit(1);

            if (!closed && inboxRows && inboxRows.length > 0) {
              inboxSince = (inboxRows[0] as { created_at: string }).created_at;
              controller.enqueue(signal("inbox"));
            }
          }

          // ── Presence changes for watched users ────────────────
          // Only runs when the client provided a ?watch list.
          // We query only the columns needed and compare against the local
          // snapshot — emitting only on actual state transitions.
          if (!closed && watchIds.length > 0) {
            const { data: presRows } = await supabaseAdmin
              .from("profiles")
              .select("id, session_status, last_active")
              .in("id", watchIds);

            const now = Date.now();

            for (const row of presRows ?? []) {
              const uid       = row.id as string;
              const lastMs    = new Date(row.last_active as string).getTime();
              const fresh     = now - lastMs < ONLINE_THRESHOLD;
              const current   =
                (row.session_status as string) === "ONLINE" && fresh
                  ? "ONLINE"
                  : "OFFLINE";
              const previous  = presenceSnapshot[uid];

              if (current !== previous) {
                presenceSnapshot[uid] = current;
                controller.enqueue(eventData("presence", { userId: uid, status: current }));
              }
            }
          }

          // ── Permission/role changes for this user ─────────────
          // Re-computes effective flags (own flags ∪ role permissions) and
          // signals the client only when the set actually changes, covering
          // role assignment, role permission edits, and direct flag changes.
          if (!closed) {
            const { ids: updatedIds } = await getEffectivePermissions(asUserId(sessionId));
            const updatedHash         = [...updatedIds].sort().join(",");
            if (updatedHash !== flagsSnapshot) {
              flagsSnapshot = updatedHash;
              controller.enqueue(signal("flags"));
            }
          }

          // ── Keepalive ─────────────────────────────────────────
          if (!closed && Date.now() - kaTick > KA_MS) {
            controller.enqueue(comment("ka"));
            kaTick = Date.now();
          }
        } catch {
          // DB error — don't crash the stream; next tick retries automatically
        }

        if (!closed) setTimeout(poll, POLL_MS);
      }

      // First poll after one full interval — lets the initial page render settle
      setTimeout(poll, POLL_MS);
    },

    cancel() {
      closed = true;
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
