// app/system/chat/page.tsx
// Chat: channels with permissions + real DMs with search.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatSidebar }  from "@/components/system/chat/ChatSidebar";
import { MessageLog }   from "@/components/system/chat/MessageLog";
import { CliInput }     from "@/components/system/chat/CliInput";
import { useSession }   from "@/components/system/SessionContext";
import { useProfile }   from "@/components/system/SessionContext";
import {
  type Channel, type ChatMessage, type DMConversation, type DirectMessage,
} from "@/components/system/chat/types";

// ─── Row types ────────────────────────────────────────────────
interface MessageRow {
  id: string; channel_id: string; user_id: string;
  user_handle: string; body: string; type: string; created_at: string;
}

interface DMRow {
  id: string; from_user_id: string; to_user_id: string;
  from_handle: string; to_handle: string; body: string; read: boolean; created_at: string;
}

function rowToMessage(m: MessageRow): ChatMessage {
  return {
    id:        m.id,
    channel:   m.channel_id,
    timestamp: new Date(m.created_at).toTimeString().slice(0, 8),
    user:      m.user_handle,
    userId:    m.user_id,
    text:      m.body,
    type:      m.type as "message" | "system",
  };
}

function dmRowToMessage(m: DMRow, myId: string): ChatMessage {
  return {
    id:        m.id,
    channel:   `dm:${m.from_user_id === myId ? m.to_user_id : m.from_user_id}`,
    timestamp: new Date(m.created_at).toTimeString().slice(0, 8),
    user:      m.from_handle,
    userId:    m.from_user_id,
    text:      m.body,
    type:      "message",
  };
}

function nowTimestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

// ─── Component ────────────────────────────────────────────────
export default function ChatPage() {
  const session = useSession();
  const profile = useProfile();

  const [channels,      setChannels]      = useState<Channel[]>([]);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [dmConvos,      setDmConvos]      = useState<DMConversation[]>([]);
  const [activeChannel, setActiveChannel] = useState("global-ops");
  const [activeDmUser,  setActiveDmUser]  = useState<string | undefined>();
  const [isDm,          setIsDm]          = useState(false);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [forbidden,     setForbidden]     = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived permissions for active channel ─────────────────
  const isAdmin   = profile.accessFlags.includes("Administrator");
  const canDelete = isDm
    ? true  // DM: enforced server-side (own messages only)
    : isAdmin || profile.accessFlags.includes(`delete-msg:${activeChannel}`);

  // ── Load channels ──────────────────────────────────────────
  const fetchChannels = useCallback(async () => {
    const res  = await fetch("/api/chat/channels");
    const data = await res.json();
    if (Array.isArray(data)) setChannels(data);
  }, []);

  // ── Load DM conversations ──────────────────────────────────
  const fetchDmConvos = useCallback(async () => {
    const res  = await fetch("/api/chat/dm?conversations=1");
    const data = await res.json();
    if (Array.isArray(data)) setDmConvos(data);
  }, []);

  useEffect(() => {
    fetchChannels();
    fetchDmConvos();
  }, [fetchChannels, fetchDmConvos]);

  // ── Load messages ──────────────────────────────────────────
  const loadMessages = useCallback(async (channelId: string, dmUserId?: string) => {
    setLoadingMsgs(true);
    setMessages([]);
    setForbidden(false);

    try {
      if (dmUserId) {
        const res  = await fetch(`/api/chat/dm?with=${dmUserId}`);
        const data = await res.json() as DMRow[];
        if (Array.isArray(data)) setMessages(data.map((m) => dmRowToMessage(m, session.id)));
      } else {
        const res = await fetch(`/api/chat/messages?channel=${channelId}`);
        if (res.status === 403) { setForbidden(true); setLoadingMsgs(false); return; }
        const data = await res.json() as MessageRow[];
        if (Array.isArray(data)) setMessages(data.map(rowToMessage));
      }
    } catch (e) { console.error("[chat]", e); }
    finally { setLoadingMsgs(false); }
  }, [session.id]);

  useEffect(() => {
    loadMessages(activeChannel, activeDmUser);
  }, [activeChannel, activeDmUser, loadMessages]);

  // ── Poll every 3s ─────────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        let data: (MessageRow | DMRow)[] = [];
        if (isDm && activeDmUser) {
          const res = await fetch(`/api/chat/dm?with=${activeDmUser}`);
          data = await res.json();
        } else {
          const res = await fetch(`/api/chat/messages?channel=${activeChannel}`);
          if (!res.ok) return;
          data = await res.json();
        }
        if (!Array.isArray(data)) return;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = isDm && activeDmUser
            ? (data as DMRow[]).map((m) => dmRowToMessage(m, session.id)).filter((m) => !existingIds.has(m.id))
            : (data as MessageRow[]).map(rowToMessage).filter((m) => !existingIds.has(m.id) && !m.id.startsWith("opt-"));

          if (newMsgs.length === 0) return prev;
          const withoutOptimistic = prev.filter((m) => {
            if (!m.id.startsWith("opt-")) return true;
            return !newMsgs.some((n) => n.user === m.user && n.text === m.text);
          });
          return [...withoutOptimistic, ...newMsgs];
        });
      } catch { /* silent */ }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChannel, activeDmUser, isDm, session.id]);

  // ── Handle sidebar selection ───────────────────────────────
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

  // ── Send message ───────────────────────────────────────────
  async function handleSend(text: string) {
    const optimisticId = `opt-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id:        optimisticId,
        channel:   isDm && activeDmUser ? `dm:${activeDmUser}` : activeChannel,
        timestamp: nowTimestamp(),
        user:      session.name.toLowerCase(),
        userId:    session.id,
        text,
        type:      "message",
      },
    ]);

    try {
      if (isDm && activeDmUser) {
        const res = await fetch("/api/chat/dm", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toUserId: activeDmUser, text }),
        });
        if (!res.ok) throw new Error(await res.text());
        fetchDmConvos();
      } else {
        const res = await fetch("/api/chat/messages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeChannel, text }),
        });
        if (!res.ok) throw new Error(await res.text());
      }
    } catch (e) {
      console.error("[chat] send:", e);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }
  }

  // ── Delete message ─────────────────────────────────────────
  async function handleDelete(msgId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      if (isDm) {
        await fetch(`/api/chat/dm?id=${msgId}`, { method: "DELETE" });
      } else {
        const res = await fetch(`/api/chat/messages?id=${msgId}`, { method: "DELETE" });
        if (!res.ok) {
          // Restore on failure
          loadMessages(activeChannel, activeDmUser);
        }
      }
    } catch { loadMessages(activeChannel, activeDmUser); }
  }

  // ── Header label ───────────────────────────────────────────
  const channelMeta = isDm
    ? dmConvos.find((d) => d.userId === activeDmUser)
    : channels.find((c) => c.id === activeChannel);

  const headerLabel = isDm
    ? `@${dmConvos.find((d) => d.userId === activeDmUser)?.handle ?? "unknown"}`
    : (channelMeta as Channel | undefined)?.label ?? `#${activeChannel}`;

  const headerTopic = isDm
    ? "direct message · end-to-end encrypted"
    : (channelMeta as Channel | undefined)?.topic ?? "";

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSidebar
        channels={channels}
        activeChannel={activeChannel}
        onSelect={handleSelect}
        dmConvos={dmConvos}
        activeDmUser={activeDmUser}
        onRefreshDms={fetchDmConvos}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg">
        {/* Channel header */}
        <div className="h-9 shrink-0 flex items-center px-4 border-b border-zk-border bg-zk-surface/30">
          <span className="font-mono text-xs text-zk-green tracking-widest">{headerLabel}</span>
          <span className="ml-3 font-mono text-[10px] text-zk-muted/50 tracking-wide">
            — {headerTopic}
          </span>
          {loadingMsgs && (
            <span className="ml-auto font-mono text-[9px] text-zk-muted/40 tracking-widest animate-pulse">
              LOADING...
            </span>
          )}
        </div>

        {/* Forbidden state */}
        {forbidden ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <span className="font-mono text-2xl text-zk-red/30">⊘</span>
            <p className="font-mono text-xs text-zk-red/60 tracking-widest">ACCESS DENIED</p>
            <p className="font-mono text-[10px] text-zk-muted/40">
              You do not have permission to view this channel.
            </p>
          </div>
        ) : (
          <>
            <MessageLog
              messages={messages}
              canDelete={canDelete}
              onDelete={handleDelete}
            />
            <CliInput channelLabel={headerLabel} onSend={handleSend} />
          </>
        )}
      </div>
    </div>
  );
}
