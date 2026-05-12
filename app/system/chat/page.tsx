// app/system/chat/page.tsx

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Wifi }               from "lucide-react";
import { ChatSidebar }        from "@/components/system/chat/ChatSidebar";
import { MessageLog }         from "@/components/system/chat/MessageLog";
import { CliInput }           from "@/components/system/chat/CliInput";
import { TypingIndicator }    from "@/components/system/chat/TypingIndicator";
import { NotificationsPanel } from "@/components/system/chat/NotificationsPanel";
import { useSession }         from "@/components/system/SessionContext";
import { useProfile }         from "@/components/system/SessionContext";
import { cn }                 from "@/lib/utils";
import { getChatCache }       from "@/lib/chat-cache";
import { getAppCache }        from "@/lib/app-cache";
import { supabase }           from "@/lib/supabase/client";
import {
  type Channel, type ChatMessage, type DMConversation,
  type TypingUser, type AppNotification,
} from "@/components/system/chat/types";
import { channelPerm } from "@/lib/types/permission";

// ── Raw API row shapes ───────────────────────────────────────────────────────

interface MessageRow {
  id: string; channel_id: string; user_id: string;
  body: string; type: string; created_at: string;
  edited_at?: string | null;
}

interface DMRow {
  id: string; from_user_id: string; to_user_id: string;
  from_handle: string; to_handle: string; body: string;
  read: boolean; created_at: string; edited_at?: string | null;
}

// ── Row → ChatMessage converters ─────────────────────────────────────────────

function rowToMessage(m: MessageRow): ChatMessage {
  const d = new Date(m.created_at);
  return {
    id:        m.id,
    channel:   m.channel_id,
    timestamp: d.toTimeString().slice(0, 8),
    date:      d.toISOString().slice(0, 10),
    user:      "",
    userId:    m.user_id,
    text:      m.body,
    type:      m.type as "message" | "system",
    edited:    !!m.edited_at,
    editedAt:  m.edited_at ?? undefined,
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
    read:      m.read,
    edited:    !!m.edited_at,
    editedAt:  m.edited_at ?? undefined,
  };
}

function nowTimestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

function cacheKey(channelId: string, dmUserId?: string): string {
  return dmUserId ? `dm:${dmUserId}` : `ch:${channelId}`;
}

// Typing context — must match the server-side format in stream/route.ts
function typingContext(channelId: string, isDm: boolean, dmUserId?: string, myId?: string): string {
  if (isDm && dmUserId && myId) {
    return `dm:${[myId, dmUserId].sort().join(":")}`;
  }
  return `channel:${channelId}`;
}

// ── Typing TTL ───────────────────────────────────────────────────────────────
const TYPING_TTL_MS = 5_000;

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

  const [userProfiles, setUserProfiles] = useState<
    Record<string, { displayName: string; username: string }>
  >({});
  const fetchedUserIds = useRef<Set<string>>(new Set());

  // ── Typing state ──────────────────────────────────────────
  // Map: userId → { user_id, handle, updated_at }
  const [typingMap, setTypingMap] = useState<Map<string, TypingUser>>(new Map());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Notifications state ───────────────────────────────────
  const [notifications,   setNotifications]   = useState<AppNotification[]>([]);
  const [notifUnread,     setNotifUnread]      = useState(0);
  const [notifPanelOpen,  setNotifPanelOpen]   = useState(false);

  // ── Stable refs ───────────────────────────────────────────
  const activeKeyRef  = useRef<string>("");
  const sseRef        = useRef<EventSource | null>(null);
  const rtRef         = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeDmRef   = useRef<string | undefined>(undefined);
  const isDmRef       = useRef<boolean>(false);

  const isAdmin        = profile.accessFlags.includes("c3ea3541-3bd7-40e6-aefe-29dc1a455088");
  const isChannelsMgr  = isAdmin || profile.accessFlags.includes("0dfd2b9c-644c-4dcd-8289-fcbeaa91d520");
  const canDelete = isAdmin || profile.accessFlags.includes(channelPerm("delete-msg", activeChannel));

  // ── Typing helpers ─────────────────────────────────────────
  function applyTypingEvent(typers: TypingUser[]) {
    setTypingMap((prev) => {
      const next = new Map(prev);
      for (const t of typers) {
        if (t.user_id === session.id) continue;
        next.set(t.user_id, t);
        // Auto-expire after TTL
        const existing = typingTimers.current.get(t.user_id);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setTypingMap((m) => {
            const n = new Map(m);
            n.delete(t.user_id);
            return n;
          });
          typingTimers.current.delete(t.user_id);
        }, TYPING_TTL_MS);
        typingTimers.current.set(t.user_id, timer);
      }
      return next;
    });
  }

  // ── Fetch channels ─────────────────────────────────────────
  const fetchChannels = useCallback(async () => {
    const cache  = getChatCache();
    const cached = cache.getChannels();
    if (cached) {
      setChannels(cached);
      setLoadingChannels(false);
      if (cache.isChannelsFresh()) return;
    }
    try {
      const res  = await fetch("/api/chat/channels");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        cache.setChannels(data);
        setChannels(data);
      }
    } catch { /* silent */ }
    finally   { setLoadingChannels(false); }
  }, []);

  // ── Fetch DM convos ────────────────────────────────────────
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

  useEffect(() => { activeDmRef.current = activeDmUser; }, [activeDmUser]);
  useEffect(() => { isDmRef.current     = isDm;         }, [isDm]);

  // ── Cache event listeners ──────────────────────────────────
  useEffect(() => {
    function onDmCacheUpdate() {
      const cached = getChatCache().getDmConvos();
      if (!cached) return;
      const activeId = activeDmRef.current;
      if (isDmRef.current && activeId) {
        setDmConvos(cached.map((d) => d.userId === activeId ? { ...d, unread: 0 } : d));
      } else {
        setDmConvos(cached);
      }
    }
    window.addEventListener("zk:cache:dm", onDmCacheUpdate);
    return () => window.removeEventListener("zk:cache:dm", onDmCacheUpdate);
  }, []);

  useEffect(() => {
    function onChannelsCacheUpdate() {
      const cached = getChatCache().getChannels();
      if (cached) setChannels(cached);
    }
    window.addEventListener("zk:cache:channels", onChannelsCacheUpdate);
    return () => window.removeEventListener("zk:cache:channels", onChannelsCacheUpdate);
  }, []);

  // ── Hydrate + initial load ─────────────────────────────────
  useEffect(() => {
    getChatCache().hydrate();
    getAppCache().hydrate();
    const cachedCh  = getChatCache().getChannels();
    const cachedDms = getChatCache().getDmConvos();
    if (cachedCh)  { setChannels(cachedCh);   setLoadingChannels(false); }
    if (cachedDms) { setDmConvos(cachedDms);  setLoadingDms(false); }
    fetchChannels();
    fetchDmConvos();
  }, [fetchChannels, fetchDmConvos]);

  useEffect(() => {
    const id = setInterval(fetchChannels, 20_000);
    return () => clearInterval(id);
  }, [fetchChannels]);

  // ── Load notifications ─────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json() as { notifications: AppNotification[]; unread: number };
      setNotifications(data.notifications ?? []);
      setNotifUnread(data.unread ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Presence ───────────────────────────────────────────────
  const fetchPresence = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const cache  = getChatCache();
    const cached = cache.getPresence();
    if (cached) setPresence(cached);
    if (cache.isPresenceFresh() && cached && ids.every((id) => id in cached)) return;
    try {
      const res = await fetch(`/api/presence?ids=${ids.join(",")}`);
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data === "object" && !Array.isArray(data) && !("error" in data)) {
        cache.setPresence(data as Record<string, "ONLINE" | "OFFLINE">);
        setPresence(cache.getPresence()!);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchPresence(dmConvos.map((d) => d.userId));
  }, [dmConvos, fetchPresence]);

  useEffect(() => {
    function onPresencePush() {
      const cached = getChatCache().getPresence();
      if (cached) setPresence(cached);
    }
    window.addEventListener("zk:cache:presence", onPresencePush);
    return () => window.removeEventListener("zk:cache:presence", onPresencePush);
  }, []);

  // ── Profile resolution ─────────────────────────────────────
  useEffect(() => {
    const newIds = [...new Set(
      messages
        .map((m) => m.userId)
        .filter((id) => id && !fetchedUserIds.current.has(id)),
    )];
    if (newIds.length === 0) return;
    newIds.forEach((id) => fetchedUserIds.current.add(id));
    fetch(`/api/chat/profiles?ids=${newIds.join(",")}`)
      .then((r) => r.json())
      .then((data: Record<string, { displayName: string; username: string }>) => {
        if (typeof data === "object" && !Array.isArray(data)) {
          setUserProfiles((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
    fetchPresence(newIds);
  }, [messages, fetchPresence]);

  // ── Channel online count ───────────────────────────────────
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

  // ── Message load ───────────────────────────────────────────
  const loadMessages = useCallback(async (channelId: string, dmUserId?: string) => {
    const key   = cacheKey(channelId, dmUserId);
    const cache = getChatCache();
    activeKeyRef.current = key;

    const cached = cache.getMessages(key);
    if (cached) {
      setMessages(cached);
      setLoadingMsgs(false);
      setForbidden(false);
      if (cache.isMessagesFresh(key)) return;
    } else {
      setLoadingMsgs(true);
      setMessages([]);
      setForbidden(false);
    }

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

  // ── SSE real-time feed ─────────────────────────────────────
  useEffect(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const capturedIsDm    = isDm;
    const capturedDmUser  = activeDmUser;
    const capturedChannel = activeChannel;
    const key = cacheKey(capturedChannel, capturedIsDm ? capturedDmUser : undefined);

    const url = capturedIsDm && capturedDmUser
      ? `/api/chat/stream?type=dm&with=${capturedDmUser}`
      : `/api/chat/stream?type=channel&id=${capturedChannel}`;

    const es = new EventSource(url);
    sseRef.current = es;

    // ── New messages ─────────────────────────────────────────
    es.addEventListener("msg", (e: MessageEvent) => {
      try {
        const rows = JSON.parse(e.data as string) as unknown[];
        if (!Array.isArray(rows) || rows.length === 0) return;
        const cache = getChatCache();
        let incoming: ChatMessage[];
        if (capturedIsDm && capturedDmUser) {
          incoming = (rows as DMRow[]).map((m) => dmRowToMessage(m, session.id));
        } else {
          incoming = (rows as MessageRow[]).map(rowToMessage);
        }
        const { changed } = cache.mergeMessages(key, incoming);
        if (!changed || activeKeyRef.current !== key) return;
        const confirmed = cache.getMessages(key) ?? [];
        setMessages((prev) => {
          const pendingOpts = prev.filter(
            (m) => m.id.startsWith("opt-") &&
              !confirmed.some((c) => c.user === m.user && c.text === m.text),
          );
          return [...confirmed, ...pendingOpts];
        });
      } catch { /* malformed payload */ }
    });

    // ── Edits ─────────────────────────────────────────────────
    es.addEventListener("update", (e: MessageEvent) => {
      try {
        const rows = JSON.parse(e.data as string) as unknown[];
        if (!Array.isArray(rows) || rows.length === 0) return;
        if (activeKeyRef.current !== key) return;
        const cache = getChatCache();
        for (const raw of rows) {
          let updated: ChatMessage;
          if (capturedIsDm && capturedDmUser) {
            updated = dmRowToMessage(raw as DMRow, session.id);
          } else {
            updated = rowToMessage(raw as MessageRow);
          }
          cache.patchMessage(key, updated.id, { text: updated.text, edited: true, editedAt: updated.editedAt });
          setMessages((prev) =>
            prev.map((m) => m.id === updated.id
              ? { ...m, text: updated.text, edited: true, editedAt: updated.editedAt }
              : m,
            ),
          );
        }
      } catch { /* malformed */ }
    });

    // ── Read receipts ─────────────────────────────────────────
    es.addEventListener("read", (e: MessageEvent) => {
      try {
        const { id } = JSON.parse(e.data as string) as { id: string };
        if (!id || activeKeyRef.current !== key) return;
        const cache = getChatCache();
        cache.patchMessage(key, id, { read: true });
        setMessages((prev) =>
          prev.map((m) => m.id === id ? { ...m, read: true } : m),
        );
      } catch { /* malformed */ }
    });

    // ── Typing indicators ─────────────────────────────────────
    es.addEventListener("typing", (e: MessageEvent) => {
      try {
        const typers = JSON.parse(e.data as string) as TypingUser[];
        if (Array.isArray(typers)) applyTypingEvent(typers);
      } catch { /* malformed */ }
    });

    // ── Notifications ─────────────────────────────────────────
    es.addEventListener("notif", (e: MessageEvent) => {
      try {
        const notif = JSON.parse(e.data as string) as AppNotification;
        setNotifications((prev) => [notif, ...prev].slice(0, 50));
        setNotifUnread((n) => n + 1);
      } catch { /* malformed */ }
    });

    return () => {
      es.close();
      sseRef.current = null;
    };
    // applyTypingEvent is defined in component body — stable enough with useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel, activeDmUser, isDm, session.id]);

  // ── Supabase Realtime (client-side direct channel) ─────────
  useEffect(() => {
    if (rtRef.current) {
      supabase.removeChannel(rtRef.current);
      rtRef.current = null;
    }

    const capturedIsDm    = isDm;
    const capturedDmUser  = activeDmUser;
    const capturedChannel = activeChannel;
    const capturedMyId    = session.id;
    const key             = cacheKey(capturedChannel, capturedIsDm ? capturedDmUser : undefined);
    const cache           = getChatCache();

    function applyIncoming(msg: ChatMessage) {
      if (activeKeyRef.current !== key) return;
      const { changed } = cache.mergeMessages(key, [msg]);
      if (!changed) return;
      const confirmed = cache.getMessages(key) ?? [];
      setMessages((prev) => {
        const pendingOpts = prev.filter(
          (m) => m.id.startsWith("opt-") &&
            !confirmed.some((c) => c.user === m.user && c.text === m.text),
        );
        return [...confirmed, ...pendingOpts];
      });
    }

    let channel: ReturnType<typeof supabase.channel>;

    if (capturedIsDm && capturedDmUser) {
      channel = supabase
        .channel(`zk-dm-${[capturedMyId, capturedDmUser].sort().join("-")}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "direct_messages" },
          (payload) => {
            const row = payload.new as unknown as DMRow;
            const relevant =
              (row.from_user_id === capturedMyId   && row.to_user_id === capturedDmUser) ||
              (row.from_user_id === capturedDmUser && row.to_user_id === capturedMyId);
            if (relevant) applyIncoming(dmRowToMessage(row, capturedMyId));
          },
        )
        .subscribe();
    } else {
      channel = supabase
        .channel(`zk-ch-${capturedChannel}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "messages",
            filter: `channel_id=eq.${capturedChannel}` },
          (payload) => applyIncoming(rowToMessage(payload.new as unknown as MessageRow)),
        )
        .subscribe();
    }

    rtRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      rtRef.current = null;
    };
  }, [activeChannel, activeDmUser, isDm, session.id]);

  // ── 30 s fallback poll ─────────────────────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      if (sseRef.current?.readyState === EventSource.OPEN) return;
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
        const { changed } = cache.mergeMessages(key, incoming);
        if (!changed || activeKeyRef.current !== key) return;
        const confirmed = cache.getMessages(key) ?? [];
        setMessages((prev) => {
          const pendingOpts = prev.filter(
            (m) => m.id.startsWith("opt-") &&
              !confirmed.some((c) => c.user === m.user && c.text === m.text),
          );
          return [...confirmed, ...pendingOpts];
        });
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(id);
  }, [activeChannel, activeDmUser, isDm, session.id]);

  // ── Sidebar select ─────────────────────────────────────────
  function handleSelect(id: string, type: "channel" | "dm", dmUserId?: string, dmHandle?: string) {
    // Clear typing state on conversation switch
    setTypingMap(new Map());
    typingTimers.current.forEach(clearTimeout);
    typingTimers.current.clear();

    if (type === "dm" && dmUserId) {
      setActiveDmUser(dmUserId);
      setActiveChannel(id);
      setIsDm(true);
      setDmConvos((prev) => {
        if (prev.some((d) => d.userId === dmUserId)) {
          const updated = prev.map((d) =>
            d.userId === dmUserId ? { ...d, unread: 0 } : d,
          );
          getChatCache().setDmConvos(updated);
          return updated;
        }
        if (dmHandle) {
          return [
            { userId: dmUserId, handle: dmHandle, unread: 0, lastMsg: "", lastTime: "" },
            ...prev,
          ];
        }
        return prev;
      });
    } else {
      setActiveDmUser(undefined);
      setActiveChannel(id);
      setIsDm(false);
    }
  }

  // ── Send ───────────────────────────────────────────────────
  async function handleSend(text: string) {
    const optimisticId  = `opt-${Date.now()}`;
    const key           = cacheKey(activeChannel, isDm ? activeDmUser : undefined);
    const cache         = getChatCache();

    const optimisticMsg: ChatMessage = {
      id:        optimisticId,
      channel:   isDm && activeDmUser ? `dm:${activeDmUser}` : activeChannel,
      timestamp: nowTimestamp(),
      date:      new Date().toISOString().slice(0, 10),
      user:      (profile.displayName || session.name).toLowerCase(),
      userId:    session.id,
      text,
      type:      "message",
    };

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
        cache.addConfirmedMessage(key, confirmedMsg);
        setMessages((prev) =>
          prev.map((m) => m.id === optimisticId ? { ...m, id: confirmed.id } : m),
        );
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
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }
  }

  // ── Edit ───────────────────────────────────────────────────
  async function handleEdit(msgId: string, text: string) {
    const key   = cacheKey(activeChannel, isDm ? activeDmUser : undefined);
    const cache = getChatCache();

    // Optimistic update
    cache.patchMessage(key, msgId, { text, edited: true });
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, text, edited: true } : m),
    );

    try {
      const url  = isDm ? "/api/chat/dm" : "/api/chat/messages";
      const res  = await fetch(url, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: msgId, text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json() as (MessageRow | DMRow);
      const editedAt = (updated as MessageRow).edited_at ?? undefined;
      cache.patchMessage(key, msgId, { editedAt });
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, editedAt } : m),
      );
    } catch (e) {
      console.error("[chat] edit:", e);
      loadMessages(activeChannel, activeDmUser);
    }
  }

  // ── Delete ─────────────────────────────────────────────────
  async function handleDelete(msgId: string) {
    const key   = cacheKey(activeChannel, isDm ? activeDmUser : undefined);
    const cache = getChatCache();
    cache.removeMessage(key, msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      const res = isDm
        ? await fetch(`/api/chat/dm?id=${msgId}`,       { method: "DELETE" })
        : await fetch(`/api/chat/messages?id=${msgId}`, { method: "DELETE" });
      if (!res.ok) loadMessages(activeChannel, activeDmUser);
    } catch {
      loadMessages(activeChannel, activeDmUser);
    }
  }

  // ── Typing ─────────────────────────────────────────────────
  // Called from CliInput on every keystroke; debounced here to POST at most
  // once every 3 s (server TTL is 5 s, so this keeps the indicator alive
  // as long as the user is actively typing).
  const lastTypingSent = useRef<number>(0);

  function handleTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 3_000) return; // already sent recently
    lastTypingSent.current = now;

    const ctx    = typingContext(activeChannel, isDm, activeDmUser, session.id);
    const handle = (profile.displayName || session.name).toLowerCase();

    fetch("/api/chat/typing", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ context: ctx, handle }),
    }).catch(() => {});
  }

  // ── Notifications panel ─────────────────────────────────────
  function handleNotifToggle() {
    setNotifPanelOpen((v) => !v);
    if (!notifPanelOpen && notifUnread > 0) {
      // Mark all as read when opening
      fetch("/api/notifications", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ all: true }),
      }).catch(() => {});
      setNotifUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  function handleNotifNavigate(n: AppNotification) {
    setNotifPanelOpen(false);
    if (n.source_type === "channel" && n.channel_id) {
      handleSelect(n.channel_id, "channel");
    }
    // DM navigation not implemented here (no to_user_id in notification)
  }

  // ── Open DM from profile card ──────────────────────────────
  function handleOpenDm(userId: string, username: string) {
    handleSelect(`dm:${userId}`, "dm", userId, username);
  }

  // ── Channel CRUD ────────────────────────────────────────────
  async function handleCreateChannel(
    label: string, topic: string,
    isPublic: boolean, viewPermission: string | null, deletePermission: string | null,
  ) {
    const res = await fetch("/api/chat/channels", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ label, topic, isPublic, viewPermission, deletePermission }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to create channel");
    }
    getChatCache().invalidateChannels();
    await fetchChannels();
  }

  async function handleEditChannel(
    id: string, label: string, topic: string,
    isPublic: boolean, viewPermission: string | null, deletePermission: string | null,
  ) {
    const res = await fetch("/api/chat/channels", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, label, topic, isPublic, viewPermission, deletePermission }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to update channel");
    }
    getChatCache().invalidateChannels();
    await fetchChannels();
  }

  async function handleDeleteChannel(channelId: string) {
    const res = await fetch(`/api/chat/channels?id=${encodeURIComponent(channelId)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to delete channel");
    }
    getChatCache().invalidateChannels();
    await fetchChannels();
    if (activeChannel === channelId && !isDm) {
      const remaining = channels.filter((c) => c.id !== channelId);
      if (remaining.length > 0) handleSelect(remaining[0].id, "channel");
    }
  }

  // ── Derived header values ──────────────────────────────────
  const convKey   = cacheKey(activeChannel, isDm ? activeDmUser : undefined);
  const activeCh  = channels.find((c) => c.id === activeChannel);
  const activeDm  = dmConvos.find((d) => d.userId === activeDmUser);

  const headerLabel = isDm
    ? `@${activeDm?.handle ?? "unknown"}`
    : activeCh?.label ?? `#${activeChannel}`;

  const headerTopic = isDm ? "direct message" : (activeCh?.topic ?? "");
  const memberCount = isDm ? 0 : channelOnline;
  const username    = (profile.displayName || session.name).toLowerCase();

  // Active typers for current conversation
  const typingUsers = [...typingMap.values()];

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* Sidebar */}
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
        isAdmin={isChannelsMgr}
        onCreateChannel={handleCreateChannel}
        onEditChannel={handleEditChannel}
        onDeleteChannel={handleDeleteChannel}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg">

        {/* Header */}
        <div className={cn(
          "shrink-0 h-12 flex items-center px-5 gap-4",
          "border-b border-zk-border/60 bg-[rgba(13,17,23,0.7)]",
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-sans text-sm font-semibold text-zk-white truncate">
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
            <span className="font-sans text-sm text-zk-muted/50 truncate flex-1 min-w-0">
              {headerTopic}
            </span>
          )}

          {/* Online count or DM presence */}
          {!isDm && memberCount > 0 && (
            <div className="shrink-0 flex items-center gap-1.5 ml-auto">
              <Wifi size={11} className="text-zk-green/50" />
              <span className="font-sans text-xs text-zk-muted/50">{memberCount} online</span>
            </div>
          )}
          {isDm && activeDmUser && (
            <div className="shrink-0 flex items-center gap-1.5 ml-auto">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                presence[activeDmUser] === "ONLINE"
                  ? "bg-zk-green shadow-glow-sm"
                  : "bg-zk-muted/30",
              )} />
              <span className="font-sans text-xs text-zk-muted/50">
                {presence[activeDmUser] === "ONLINE" ? "online" : "offline"}
              </span>
            </div>
          )}

          {/* Notifications bell */}
          <NotificationsPanel
            notifications={notifications}
            unread={notifUnread}
            open={notifPanelOpen}
            onToggle={handleNotifToggle}
            onNavigate={handleNotifNavigate}
          />
        </div>

        {/* Content */}
        {forbidden ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-sm border border-zk-red/20 bg-zk-red/5 flex items-center justify-center">
              <span className="font-mono text-xl text-zk-red/40">⊘</span>
            </div>
            <p className="font-sans text-sm text-zk-red/50">Access Denied</p>
            <p className="font-sans text-sm text-zk-muted/30 max-w-xs text-center">
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
              onEdit={handleEdit}
              currentUserId={session.id}
              loading={loadingMsgs}
              userProfiles={userProfiles}
              presence={presence}
              onOpenDm={handleOpenDm}
              isDm={isDm}
              conversationKey={convKey}
              isAdmin={isAdmin}
            />
            <TypingIndicator typers={typingUsers} />
            <CliInput
              channelLabel={headerLabel}
              username={username}
              onSend={handleSend}
              onTyping={handleTyping}
            />
          </>
        )}
      </div>
    </div>
  );
}
