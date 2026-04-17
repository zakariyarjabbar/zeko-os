// components/system/ShellPrefetcher.tsx
// Invisible client component mounted once inside the system shell.
//
// Boot sequence:
//   1. Hydrate both caches from sessionStorage instantly (no flash)
//   2. Parallel-fetch all resources the user can access (channels, DMs,
//      inbox, roles) before they navigate to any of those pages
//   3. Open /api/stream/events?watch=dmPartnerIds:
//        • Receives DM / inbox change SIGNALS → re-fetches only that resource
//        • Receives PRESENCE PUSH for DM partners → updates cache immediately
//        • No polling anywhere — all updates are event-driven after this
//   4. Background safety-net intervals (1-3 min) in case an SSE reconnect
//      missed a change during the reconnect window
//
// Window events dispatched (for other components to react):
//   "zk:cache:dm"       — DM conversation list updated
//   "zk:cache:inbox"    — Inbox list updated
//   "zk:cache:presence" — Presence map updated (also fires on presence push)
//
// Security:
//   • Every fetch is auth-gated server-side
//   • watch IDs are validated as UUIDs on the server (50-ID cap)
//   • Presence data (online/offline) is non-sensitive — same access model as
//     the existing GET /api/presence endpoint
//   • This component never reads or transmits sensitive fields

"use client";

import { useEffect }                   from "react";
import { getChatCache }                from "@/lib/chat-cache";
import { getAppCache }                 from "@/lib/app-cache";
import { canViewInbox, canViewUsers, isFounder } from "@/lib/permissions";
import { type Permission }             from "@/lib/types/permission";
import type { Channel, DMConversation }        from "@/components/system/chat/types";
import type { CachedInboxItem, CachedRole, CachedPermission, CachedUser } from "@/lib/app-cache";

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function prefetchChannels(): Promise<void> {
  const cache = getChatCache();
  if (cache.isChannelsFresh()) return;
  try {
    const res = await fetch("/api/chat/channels");
    if (!res.ok) return;
    const data = await res.json() as Channel[];
    if (Array.isArray(data)) cache.setChannels(data);
  } catch { /* silent — pages fetch on demand */ }
}

async function prefetchDmConvos(): Promise<void> {
  const cache = getChatCache();
  if (cache.isDmConvosFresh()) return;
  try {
    const res = await fetch("/api/chat/dm?conversations=1");
    if (!res.ok) return;
    const data = await res.json() as DMConversation[];
    if (Array.isArray(data)) cache.setDmConvos(data);
  } catch { /* silent */ }
}

async function prefetchInbox(): Promise<void> {
  const cache = getAppCache();
  if (cache.isInboxFresh()) return;
  try {
    const res = await fetch("/api/inbox");
    if (!res.ok) return;
    const data = await res.json() as CachedInboxItem[];
    if (Array.isArray(data)) cache.setInbox(data);
  } catch { /* silent */ }
}

async function prefetchRoles(): Promise<void> {
  const cache = getAppCache();
  if (cache.isRolesFresh()) return;
  try {
    const res = await fetch("/api/roles");
    if (!res.ok) return;
    const data = await res.json() as CachedRole[];
    if (Array.isArray(data)) {
      cache.setRoles(data);
      window.dispatchEvent(new CustomEvent("zk:cache:roles"));
    }
  } catch { /* silent */ }
}

async function prefetchUsers(): Promise<void> {
  const cache = getAppCache();
  if (cache.isUsersFresh()) return;
  try {
    const res = await fetch("/api/users");
    if (!res.ok) return;
    const data = await res.json() as CachedUser[];
    if (Array.isArray(data)) {
      cache.setUsers(data);
      window.dispatchEvent(new CustomEvent("zk:cache:users"));
    }
  } catch { /* silent */ }
}

async function refetchFlags(): Promise<Permission[] | null> {
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return null;
    const { accessFlags } = await res.json() as { accessFlags: Permission[] };
    return Array.isArray(accessFlags) ? accessFlags : null;
  } catch { return null; }
}

async function prefetchPermissions(): Promise<void> {
  const cache = getAppCache();
  if (cache.isPermissionsFresh()) return;
  try {
    const res = await fetch("/api/permissions");
    if (!res.ok) return;
    const data = await res.json() as CachedPermission[];
    if (Array.isArray(data)) {
      cache.setPermissions(data);
      window.dispatchEvent(new CustomEvent("zk:cache:permissions"));
    }
  } catch { /* silent */ }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ShellPrefetcherProps {
  accessFlags: Permission[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShellPrefetcher({ accessFlags }: ShellPrefetcherProps) {
  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    // Tracks which user IDs the open SSE is watching so we can detect
    // when new DM partners appear and re-open with an updated list.
    let currentWatchSet = new Set<string>();
    const intervals: ReturnType<typeof setInterval>[] = [];

    // ── Open the SSE connection ─────────────────────────────────────────────
    // watchIds: DM partner IDs to receive presence pushes for.
    function openSSE(watchIds: string[]): void {
      if (closed) return;
      es?.close();

      currentWatchSet = new Set(watchIds);

      const url = watchIds.length > 0
        ? `/api/stream/events?watch=${watchIds.join(",")}`
        : "/api/stream/events";

      es = new EventSource(url);

      // ── New unread DM ─────────────────────────────────────────────────────
      es.addEventListener("dm", () => {
        getChatCache().invalidateDmConvos();
        prefetchDmConvos().then(() => {
          window.dispatchEvent(new CustomEvent("zk:cache:dm"));

          // If new DM partners appeared, re-open SSE with updated watch list
          const convos  = getChatCache().getDmConvos() ?? [];
          const newIds  = convos.map((d) => d.userId);
          const hasNew  = newIds.some((id) => !currentWatchSet.has(id));
          if (hasNew) openSSE(newIds.slice(0, 50));
        }).catch(() => { /* silent */ });
      });

      // ── New inbox message ─────────────────────────────────────────────────
      es.addEventListener("inbox", () => {
        if (!canViewInbox(accessFlags)) return;
        getAppCache().invalidateInbox();
        prefetchInbox().then(() => {
          window.dispatchEvent(new CustomEvent("zk:cache:inbox"));
        }).catch(() => { /* silent */ });
      });

      // ── Presence change for a watched user ────────────────────────────────
      // Server emits {"userId":"...","status":"ONLINE"|"OFFLINE"} only when
      // the status actually changes — no redundant events.
      es.addEventListener("presence", (e: MessageEvent) => {
        try {
          const { userId, status } = JSON.parse(e.data as string) as {
            userId: string;
            status: "ONLINE" | "OFFLINE";
          };
          getChatCache().setPresence({ [userId]: status });
          window.dispatchEvent(new CustomEvent("zk:cache:presence"));
        } catch { /* malformed payload — ignore */ }
      });

      // ── Permission/role change for the current user ───────────────────────
      // Server emits this signal when effective flags change (role assigned,
      // role permissions edited, or direct access_flags change).
      // Re-fetch flags → update SessionContext → re-fetch channels (access may differ).
      es.addEventListener("flags", () => {
        refetchFlags().then((newFlags) => {
          if (!newFlags) return;
          window.dispatchEvent(new CustomEvent("zk:flags:updated", { detail: newFlags }));
          // Channel permissions are derived from access flags — invalidate so
          // the chat sidebar reflects the new access immediately.
          getChatCache().invalidateChannels();
          prefetchChannels().then(() => {
            window.dispatchEvent(new CustomEvent("zk:cache:channels"));
          }).catch(() => { /* silent */ });
        }).catch(() => { /* silent */ });
      });
    }

    // ── Async boot ─────────────────────────────────────────────────────────
    async function init(): Promise<void> {
      // 1. Hydrate caches from sessionStorage so components reading them
      //    on mount see instant stale data before any network round-trip.
      getChatCache().hydrate();
      getAppCache().hydrate();

      // 2. Parallel pre-fetch — all resources the user can access
      await Promise.allSettled([
        prefetchChannels(),
        prefetchDmConvos(),
        canViewInbox(accessFlags)  ? prefetchInbox()       : Promise.resolve(),
        canViewUsers(accessFlags)  ? prefetchUsers()       : Promise.resolve(),
        isFounder(accessFlags)     ? prefetchRoles()       : Promise.resolve(),
        isFounder(accessFlags)     ? prefetchPermissions() : Promise.resolve(),
      ]);

      if (closed) return;

      // 3. Open SSE with DM partner IDs for instant presence push.
      //    DM convos were just fetched so the list is fresh.
      const convos   = getChatCache().getDmConvos() ?? [];
      const watchIds = convos.map((d) => d.userId).slice(0, 50);
      openSSE(watchIds);

      // 4. Background safety-net intervals — catch anything missed during
      //    an SSE reconnect window.  These are intentionally long because
      //    the SSE handles real-time updates.

      // Channels: rarely change — every 2 min
      intervals.push(setInterval(() => {
        getChatCache().invalidateChannels();
        prefetchChannels().catch(() => { /* silent */ });
      }, 120_000));

      // DM convos: new convos can appear — every 60 s
      intervals.push(setInterval(() => {
        getChatCache().invalidateDmConvos();
        prefetchDmConvos().then(() => {
          const convos  = getChatCache().getDmConvos() ?? [];
          const newIds  = convos.map((d) => d.userId).slice(0, 50);
          const hasNew  = newIds.some((id) => !currentWatchSet.has(id));
          if (hasNew) openSSE(newIds);
          window.dispatchEvent(new CustomEvent("zk:cache:dm"));
        }).catch(() => { /* silent */ });
      }, 60_000));

      // Inbox (if permitted): every 90 s
      if (canViewInbox(accessFlags)) {
        intervals.push(setInterval(() => {
          getAppCache().invalidateInbox();
          prefetchInbox().then(() => {
            window.dispatchEvent(new CustomEvent("zk:cache:inbox"));
          }).catch(() => { /* silent */ });
        }, 90_000));
      }

      // Users (if permitted): every 90 s
      if (canViewUsers(accessFlags)) {
        intervals.push(setInterval(() => {
          getAppCache().invalidateUsers();
          prefetchUsers().then(() => {
            window.dispatchEvent(new CustomEvent("zk:cache:users"));
          }).catch(() => { /* silent */ });
        }, 90_000));
      }

      // Roles + Permissions (if admin): every 3 min
      if (isFounder(accessFlags)) {
        intervals.push(setInterval(() => {
          getAppCache().invalidateRoles();
          getAppCache().invalidatePermissions();
          prefetchRoles().catch(() => { /* silent */ });
          prefetchPermissions().catch(() => { /* silent */ });
        }, 180_000));
      }
    }

    init().catch(() => {
      // Boot failed — open SSE without watch IDs as a fallback
      if (!closed) openSSE([]);
    });

    return () => {
      closed = true;
      es?.close();
      intervals.forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once — session flags are stable for the lifetime of the session

  return null;
}
