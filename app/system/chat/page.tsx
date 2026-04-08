// app/system/chat/page.tsx
// Redesigned chat interface.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Wifi } from "lucide-react";
import { ChatSidebar } from "@/components/system/chat/ChatSidebar";
import { MessageLog }  from "@/components/system/chat/MessageLog";
import { CliInput }    from "@/components/system/chat/CliInput";
import { useSession }  from "@/components/system/SessionContext";
import { useProfile }  from "@/components/system/SessionContext";
import { cn }          from "@/lib/utils";
import {
  type Channel, type ChatMessage, type DMConversation,
} from "@/components/system/chat/types";

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

  const isAdmin   = profile.accessFlags.includes("Administrator");
  const canDelete = isDm
    ? true
    : isAdmin || profile.accessFlags.includes(`delete-msg:${activeChannel}`);

  // ── Channels ───────────────────────────────────────────────
  const fetchChannels = useCallback(async () => {
    const res  = await fetch("/api/chat/channels");
    const data = await res.json();
    if (Array.isArray(data)) setChannels(data);
  }, []);

  // ── DM conversations ───────────────────────────────────────
  const fetchDmConvos = useCallback(async () => {
    const res  = await fetch("/api/chat/dm?conversations=1");
    const data = await res.json();
    if (Array.isArray(data)) setDmConvos(data);
  }, []);

  useEffect(() => {
    fetchChannels();
    fetchDmConvos();
  }, [fetchChannels, fetchDmConvos]);

  // ── Messages ───────────────────────────────────────────────
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
  async function handleSend(text: string) {
    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id:        optimisticId,
        channel:   isDm && activeDmUser ? `dm:${activeDmUser}` : activeChannel,
        timestamp: nowTimestamp(),
        user:      profile.username || session.name.toLowerCase(),
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

  // ── Delete ─────────────────────────────────────────────────
  async function handleDelete(msgId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      const res = isDm
        ? await fetch(`/api/chat/dm?id=${msgId}`, { method: "DELETE" })
        : await fetch(`/api/chat/messages?id=${msgId}`, { method: "DELETE" });
      if (!res.ok) loadMessages(activeChannel, activeDmUser);
    } catch { loadMessages(activeChannel, activeDmUser); }
  }

  // ── Header metadata ────────────────────────────────────────
  const activeCh   = channels.find((c) => c.id === activeChannel);
  const activeDm   = dmConvos.find((d) => d.userId === activeDmUser);

  const headerLabel = isDm
    ? `@${activeDm?.handle ?? "unknown"}`
    : activeCh?.label ?? `#${activeChannel}`;

  const headerTopic = isDm
    ? "direct message"
    : activeCh?.topic ?? "";

  const memberCount = !isDm ? (activeCh?.memberCount ?? 0) : 0;

  const username = profile.username || session.name.toLowerCase();

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
      />

      {/* ── Main area ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg">

        {/* Channel / DM header */}
        <div className={cn(
          "shrink-0 h-12 flex items-center px-5 gap-4",
          "border-b border-zk-border/60 bg-[rgba(13,17,23,0.7)]",
        )}>
          {/* Name */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm font-semibold text-zk-white tracking-wide truncate">
              {headerLabel}
            </span>
            {loadingMsgs && (
              <span className="w-1.5 h-1.5 rounded-full bg-zk-green/50 animate-pulse shrink-0" />
            )}
          </div>

          {/* Divider */}
          {headerTopic && (
            <span className="shrink-0 w-px h-4 bg-zk-border/60" aria-hidden="true" />
          )}

          {/* Topic */}
          {headerTopic && (
            <span className="font-mono text-[11px] text-zk-muted/50 truncate flex-1 min-w-0">
              {headerTopic}
            </span>
          )}

          {/* Right: member count */}
          {memberCount != null && memberCount > 0 && (
            <div className="shrink-0 flex items-center gap-1.5 ml-auto">
              <Wifi size={11} className="text-zk-green/50" />
              <span className="font-mono text-[10px] text-zk-muted/50">
                {memberCount} online
              </span>
            </div>
          )}

          {isDm && (
            <div className="shrink-0 flex items-center gap-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-zk-green shadow-glow-sm" />
              <span className="font-mono text-[10px] text-zk-muted/50">
                {activeDm?.handle}
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
              You do not have the <span className="text-zk-muted/50">view:{activeChannel}</span> permission.
            </p>
          </div>
        ) : (
          <>
            <MessageLog
              messages={messages}
              canDelete={canDelete}
              onDelete={handleDelete}
              currentUserId={session.id}
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
