// app/system/chat/page.tsx
// Chat interface — uses the Discord-style ChatCacheStore for all data.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Wifi }          from "lucide-react";
import { ChatSidebar }   from "@/components/system/chat/ChatSidebar";
import { MessageLog }    from "@/components/system/chat/MessageLog";
import { CliInput }      from "@/components/system/chat/CliInput";
import { useSession }    from "@/components/system/SessionContext";
import { useProfile }    from "@/components/system/SessionContext";
import { cn }            from "@/lib/utils";
import { getChatCache }  from "@/lib/chat-cache";
import {
  type Channel, type ChatMessage, type DMConversation,
} from "@/components/system/chat/types";

// ── Raw API row shapes ───────────────────────────────────────────────────────

interface MessageRow {
  id: string; channel_id: string; user_id: string;
  user_handle: string; body: string; type: string; created_at: string;
}

interface DMRow {
  id: string; from_user_id: string; to_user_id: string;
  from_handle: string; to_handle: string; body: string; read: boolean; created_at: string;
}

// ── Row → ChatMessage converters ─────────────────────────────────────────────

function rowToMessage(m: MessageRow): ChatMessage {
  const d = new Date(m.created_at);
  return {
    id:        m.id,
    channel:   m.channel_id,
    timestamp: d.toTimeString().slice(0, 8),
    date:      d.toISOString().slice(0, 10),
    user:      m.user_handle,
    userId:    m.user_id,
    text:      m.body,
    type:      m.type as "message" | "system",
  };
}

function dmRowToMessage(m: DMRow, myId: string): ChatMessage {
  const d = new Date(m.created_at);
  return {
    id:        m.id,
    channel:   `dm:${m.from_user_id === myId ? m.to_user_id : m.from_user_id}`,
    timestamp: d.toTimeString().slice(0, 8),
    date:      d.toISOString().slice(0, 10),
    user:      m.from_handle,
    userId:    m.from_user_id,
    text:      m.body,
    type:      "message",
  };
}

function nowTimestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

// Cache key mirrors Discord's per-channel store ("ch:<id>" or "dm:<userId>")
function cacheKey(channelId: string, dmUserId?: string): string {
  return dmUserId ? `dm:${dmUserId}` : `ch:${channelId}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const session = useSession();
  const profile = useProfile();

  // ── UI state ──────────────────────────────────────────────
  const [channels,        setChannels]        = useState<Channel[]>([]);
  const [messages,        setMessages]        = useState<ChatMessage[]>([]);
  const [dmConvos,        setDmConvos]        = useState<DMConversation[]>([]);
  const [activeChannel,   setActiveChannel]   = useState("global-ops");
  const [activeDmUser,    setActiveDmUser]    = useState<string | undefined>();
  const [isDm,            setIsDm]            = useState(false);
  const [loadingMsgs,     setLoadingMsgs]     = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingDms,      setLoadingDms]      = useState(true);
  const [forbidden,       setForbidden]       = useState(false);
  const [presence,        setPresence]        = useState<Record<string, "ONLINE" | "OFFLINE">>({});
  const [channelOnline,   setChannelOnline]   = useState(0);

  // Stable refs — never trigger re-renders
  const activeKeyRef = useRef<string>("");
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdmin   = profile.accessFlags.includes("Administrator");
  const canDelete = isDm
    ? true
    : isAdmin || profile.accessFlags.includes(`delete-msg:${activeChannel}`);

  // ── Channel list ───────────────────────────────────────────
  //
  // Behaviour (stale-while-revalidate):
  //   1. Restore from cache/sessionStorage instantly → clear skeleton
  //   2. If cache is fresh (< 30 s), skip the network round-trip
  //   3. Otherwise fetch in background and update silently
  const fetchChannels = useCallback(async () => {
    const cache  = getChatCache();
    const cached = cache.getChannels();

    if (cached) {
      setChannels(cached);
      setLoadingChannels(false);
      if (cache.isChannelsFresh()) return; // still within TTL — skip network
    }

    try {
      const res  = await fetch("/api/chat/channels");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        cache.setChannels(data);   // persist to sessionStorage + memory
        setChannels(data);
      }
    } catch { /* silent — stale data already shown */ }
    finally   { setLoadingChannels(false); }
  }, []);

  // ── DM conversation list ───────────────────────────────────
  const fetchDmConvos = useCallback(async () => {
    const cache  = getChatCache();
    const cached = cache.getDmConvos();

    if (cached) {
      setDmConvos(cached);
      setLoadingDms(false);
      if (cache.isDmConvosFresh()) return;
    }

    try {
      const res  = await fetch("/api/chat/dm?conversations=1");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        cache.setDmConvos(data);
        setDmConvos(data);
      }
    } catch { /* silent */ }
    finally   { setLoadingDms(false); }
  }, []);

  // ── Hydrate + initial load ─────────────────────────────────
  //
  // hydrate() populates the in-memory cache from sessionStorage so that
  // fetchChannels / fetchDmConvos can show cached data instantly.
  useEffect(() => {
    getChatCache().hydrate();
    fetchChannels();
    fetchDmConvos();
  }, [fetchChannels, fetchDmConvos]);

  // Background refresh every 20 s — skipped if still fresh (TTL guard inside fetchChannels)
  useEffect(() => {
    const id = setInterval(fetchChannels, 20_000);
    return () => clearInterval(id);
  }, [fetchChannels]);

  // ── Presence ───────────────────────────────────────────────
  //
  // Fetches ONLINE/OFFLINE for DM partners.
  // Merges into the cache map so we don't lose keys for partners outside the current batch.
  // Skips the network call entirely when the cached data is still within TTL.
  const fetchPresence = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const cache  = getChatCache();
    const cached = cache.getPresence();

    // Show cached data immediately while we check freshness
    if (cached) setPresence(cached);

    // All requested IDs already in a fresh cache → no network round-trip needed
    if (cache.isPresenceFresh() && cached && ids.every((id) => id in cached)) return;

    try {
      const res = await fetch(`/api/presence?ids=${ids.join(",")}`);
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data === "object" && !Array.isArray(data) && !("error" in data)) {
        cache.setPresence(data as Record<string, "ONLINE" | "OFFLINE">);
        setPresence(cache.getPresence()!); // use the merged map
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const ids = dmConvos.map((d) => d.userId);
    fetchPresence(ids);
  }, [dmConvos, fetchPresence]);

  useEffect(() => {
    const ids = dmConvos.map((d) => d.userId);
    if (ids.length === 0) return;
    const id = setInterval(() => fetchPresence(ids), 20_000);
    return () => clearInterval(id);
  }, [dmConvos, fetchPresence]);

  // ── Channel online count ───────────────────────────────────
  //
  // Dedicated endpoint so it computes effective flags (own + role-inherited),
  // not just direct access_flags on the profile row (which is almost always empty).
  const fetchChannelOnline = useCallback(async (channelId: string) => {
    try {
      const res  = await fetch(`/api/chat/channels/members?channel=${channelId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === "number") setChannelOnline(data.count);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (isDm) { setChannelOnline(0); return; }
    fetchChannelOnline(activeChannel);
  }, [activeChannel, isDm, fetchChannelOnline]);

  useEffect(() => {
    if (isDm) return;
    const id = setInterval(() => fetchChannelOnline(activeChannel), 20_000);
    return () => clearInterval(id);
  }, [activeChannel, isDm, fetchChannelOnline]);

  // ── Message load (on channel / DM switch) ─────────────────
  //
  // L1 hit  → show cached data instantly, no skeleton, skip network if fresh
  // L1 miss → show skeleton, wait for network, populate cache
  // Stale   → show cached immediately (no skeleton), silently refresh in background
  const loadMessages = useCallback(async (channelId: string, dmUserId?: string) => {
    const key   = cacheKey(channelId, dmUserId);
    const cache = getChatCache();
    activeKeyRef.current = key;

    const cached = cache.getMessages(key);

    if (cached) {
      setMessages(cached);
      setLoadingMsgs(false);
      setForbidden(false);
      // Fresh cache → no background fetch needed; poll will pick up new messages
      if (cache.isMessagesFresh(key)) return;
    } else {
      // Cold miss → skeleton while we wait
      setLoadingMsgs(true);
      setMessages([]);
      setForbidden(false);
    }

    // Background (or blocking) fetch
    try {
      if (dmUserId) {
        const res  = await fetch(`/api/chat/dm?with=${dmUserId}`);
        if (!res.ok) return;
        const data = await res.json() as DMRow[];
        if (!Array.isArray(data)) return;
        const msgs = data.map((m) => dmRowToMessage(m, session.id));
        cache.setMessages(key, msgs);
        if (activeKeyRef.current === key) setMessages(msgs);
      } else {
        const res = await fetch(`/api/chat/messages?channel=${channelId}`);
        if (res.status === 403) {
          if (activeKeyRef.current === key) setForbidden(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json() as MessageRow[];
        if (!Array.isArray(data)) return;
        const msgs = data.map(rowToMessage);
        cache.setMessages(key, msgs);
        if (activeKeyRef.current === key) setMessages(msgs);
      }
    } catch (e) {
      console.error("[chat] loadMessages:", e);
    } finally {
      if (activeKeyRef.current === key) setLoadingMsgs(false);
    }
  }, [session.id]);

  useEffect(() => {
    loadMessages(activeChannel, activeDmUser);
  }, [activeChannel, activeDmUser, loadMessages]);

  // ── Message poll (real-time new messages) ──────────────────
  //
  // Runs every 4 s for the active channel/DM.
  // Uses cache.mergeMessages — only updates React state when new messages arrive.
  // Optimistic messages (opt-xxx) are kept in state until server confirms them.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      const cache = getChatCache();
      const key   = cacheKey(activeChannel, isDm ? activeDmUser : undefined);

      try {
        let incoming: ChatMessage[];

        if (isDm && activeDmUser) {
          const res = await fetch(`/api/chat/dm?with=${activeDmUser}`);
          if (!res.ok) return;
          const data = await res.json() as DMRow[];
          if (!Array.isArray(data)) return;
          incoming = data.map((m) => dmRowToMessage(m, session.id));
        } else {
          const res = await fetch(`/api/chat/messages?channel=${activeChannel}`);
          if (!res.ok) return;
          const data = await res.json() as MessageRow[];
          if (!Array.isArray(data)) return;
          incoming = data.map(rowToMessage);
        }

        // Merge into cache — returns { changed: false } when nothing new
        const { changed } = cache.mergeMessages(key, incoming);
        if (!changed || activeKeyRef.current !== key) return;

        // Rebuild state: confirmed messages from cache + still-pending optimistics
        const confirmed = cache.getMessages(key) ?? [];
        setMessages((prev) => {
          // Keep optimistic entries whose user+text hasn't been confirmed yet
          const pendingOpts = prev.filter(
            (m) =>
              m.id.startsWith("opt-") &&
              !confirmed.some((c) => c.user === m.user && c.text === m.text),
          );
          return [...confirmed, ...pendingOpts];
        });
      } catch { /* silent */ }
    }, 4_000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChannel, activeDmUser, isDm, session.id]);

  // ── Sidebar select ─────────────────────────────────────────
  function handleSelect(id: string, type: "channel" | "dm", dmUserId?: string) {
    if (type === "dm" && dmUserId) {
      setActiveDmUser(dmUserId);
      setActiveChannel(id);
      setIsDm(true);
    } else {
      setActiveDmUser(undefined);
      setActiveChannel(id);
      setIsDm(false);
    }
  }

  // ── Send ───────────────────────────────────────────────────
  //
  // Optimistic flow:
  //   1. Add opt-xxx only to React state (NOT the cache — cache holds confirmed only)
  //   2. POST to server
  //   3a. Success → add confirmed message to cache, swap opt-xxx id in state
  //   3b. Failure → remove opt-xxx from state
  async function handleSend(text: string) {
    const optimisticId  = `opt-${Date.now()}`;
    const key           = cacheKey(activeChannel, isDm ? activeDmUser : undefined);
    const cache         = getChatCache();

    const optimisticMsg: ChatMessage = {
      id:        optimisticId,
      channel:   isDm && activeDmUser ? `dm:${activeDmUser}` : activeChannel,
      timestamp: nowTimestamp(),
      date:      new Date().toISOString().slice(0, 10),
      user:      session.name.toLowerCase(),
      userId:    session.id,
      text,
      type:      "message",
    };

    // State-only — cache never stores unconfirmed messages
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      if (isDm && activeDmUser) {
        const res = await fetch("/api/chat/dm", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ toUserId: activeDmUser, text }),
        });
        if (!res.ok) throw new Error(await res.text());

        const confirmed = await res.json() as DMRow;
        const confirmedMsg = dmRowToMessage(confirmed, session.id);

        // Add confirmed message to cache so the next poll merge is a no-op for this msg
        cache.addConfirmedMessage(key, confirmedMsg);

        // Swap the temporary id with the real one in state
        setMessages((prev) =>
          prev.map((m) => m.id === optimisticId ? { ...m, id: confirmed.id } : m),
        );

        // Refresh DM sidebar (last-message preview) — no loading flash
        fetchDmConvos();
      } else {
        const res = await fetch("/api/chat/messages", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ channelId: activeChannel, text }),
        });
        if (!res.ok) throw new Error(await res.text());

        const confirmed = await res.json() as MessageRow;
        const confirmedMsg = rowToMessage(confirmed);

        cache.addConfirmedMessage(key, confirmedMsg);
        setMessages((prev) =>
          prev.map((m) => m.id === optimisticId ? { ...m, id: confirmed.id } : m),
        );
      }
    } catch (e) {
      console.error("[chat] send:", e);
      // Roll back the optimistic entry on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }
  }

  // ── Delete ─────────────────────────────────────────────────
  async function handleDelete(msgId: string) {
    const key   = cacheKey(activeChannel, isDm ? activeDmUser : undefined);
    const cache = getChatCache();

    // Optimistic removal from both cache and state
    cache.removeMessage(key, msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));

    try {
      const res = isDm
        ? await fetch(`/api/chat/dm?id=${msgId}`,       { method: "DELETE" })
        : await fetch(`/api/chat/messages?id=${msgId}`, { method: "DELETE" });

      // If server rejected, re-load the channel to restore the correct state
      if (!res.ok) loadMessages(activeChannel, activeDmUser);
    } catch {
      loadMessages(activeChannel, activeDmUser);
    }
  }

  // ── Derived header values ──────────────────────────────────
  const activeCh  = channels.find((c) => c.id === activeChannel);
  const activeDm  = dmConvos.find((d) => d.userId === activeDmUser);

  const headerLabel = isDm
    ? `@${activeDm?.handle ?? "unknown"}`
    : activeCh?.label ?? `#${activeChannel}`;

  const headerTopic = isDm ? "direct message" : (activeCh?.topic ?? "");
  const memberCount = isDm ? 0 : channelOnline;
  const username    = session.name.toLowerCase();

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <ChatSidebar
        channels={channels}
        activeChannel={activeChannel}
        onSelect={handleSelect}
        dmConvos={dmConvos}
        activeDmUser={activeDmUser}
        onRefreshDms={fetchDmConvos}
        loadingChannels={loadingChannels}
        loadingDms={loadingDms}
        presence={presence}
      />

      {/* ── Main area ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg">

        {/* Header */}
        <div className={cn(
          "shrink-0 h-12 flex items-center px-5 gap-4",
          "border-b border-zk-border/60 bg-[rgba(13,17,23,0.7)]",
        )}>
          {/* Channel / DM name */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm font-semibold text-zk-white tracking-wide truncate">
              {headerLabel}
            </span>
            {loadingMsgs && (
              <span className="w-1.5 h-1.5 rounded-full bg-zk-green/50 animate-pulse shrink-0" />
            )}
          </div>

          {headerTopic && (
            <span className="shrink-0 w-px h-4 bg-zk-border/60" aria-hidden="true" />
          )}

          {headerTopic && (
            <span className="font-mono text-[11px] text-zk-muted/50 truncate flex-1 min-w-0">
              {headerTopic}
            </span>
          )}

          {/* Channel online count */}
          {!isDm && memberCount > 0 && (
            <div className="shrink-0 flex items-center gap-1.5 ml-auto">
              <Wifi size={11} className="text-zk-green/50" />
              <span className="font-mono text-[10px] text-zk-muted/50">
                {memberCount} online
              </span>
            </div>
          )}

          {/* DM presence indicator */}
          {isDm && activeDmUser && (
            <div className="shrink-0 flex items-center gap-1.5 ml-auto">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                presence[activeDmUser] === "ONLINE"
                  ? "bg-zk-green shadow-glow-sm"
                  : "bg-zk-muted/30",
              )} />
              <span className="font-mono text-[10px] text-zk-muted/50">
                {presence[activeDmUser] === "ONLINE" ? "online" : "offline"}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        {forbidden ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-sm border border-zk-red/20 bg-zk-red/5 flex items-center justify-center">
              <span className="font-mono text-xl text-zk-red/40">⊘</span>
            </div>
            <p className="font-mono text-xs text-zk-red/50 tracking-widest">ACCESS DENIED</p>
            <p className="font-mono text-[10px] text-zk-muted/30 max-w-xs text-center">
              You do not have the{" "}
              <span className="text-zk-muted/50">view:{activeChannel}</span> permission.
            </p>
          </div>
        ) : (
          <>
            <MessageLog
              messages={messages}
              canDelete={canDelete}
              onDelete={handleDelete}
              currentUserId={session.id}
              loading={loadingMsgs}
            />
            <CliInput
              channelLabel={headerLabel}
              username={username}
              onSend={handleSend}
            />
          </>
        )}
      </div>
    </div>
  );
}
