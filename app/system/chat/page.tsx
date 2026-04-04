// app/system/chat/page.tsx
// IRC/ops-terminal chat interface.
// Data flows through Next.js API routes (admin client) — avoids
// Supabase RLS issues with cookie-based auth.
// Realtime: polls every 3s for new messages (no Supabase session).

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatSidebar } from "@/components/system/chat/ChatSidebar";
import { MessageLog }  from "@/components/system/chat/MessageLog";
import { CliInput }    from "@/components/system/chat/CliInput";
import { useSession }  from "@/components/system/SessionContext";
import { type Channel, type ChatMessage } from "@/components/system/chat/types";

interface MessageRow {
  id:          string;
  channel_id:  string;
  user_handle: string;
  body:        string;
  type:        string;
  created_at:  string;
}

function rowToMessage(m: MessageRow): ChatMessage {
  return {
    id:        m.id,
    channel:   m.channel_id,
    timestamp: new Date(m.created_at).toTimeString().slice(0, 8),
    user:      m.user_handle,
    text:      m.body,
    type:      m.type as "message" | "system",
  };
}

function nowTimestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

export default function ChatPage() {
  const session = useSession();

  const [channels,      setChannels]      = useState<Channel[]>([]);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [activeChannel, setActiveChannel] = useState("global-ops");
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const lastMessageId   = useRef<string | null>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load channels once ──────────────────────────────────────
  useEffect(() => {
    fetch("/api/chat/channels")
      .then((r) => r.json())
      .then((data: Array<{ id: string; label: string; topic: string; member_count: number }>) => {
        if (Array.isArray(data)) {
          setChannels(data.map((c) => ({
            id:          c.id,
            label:       c.label,
            topic:       c.topic,
            memberCount: c.member_count,
            unread:      0,
          })));
        }
      })
      .catch((e) => console.error("[chat] channels:", e));
  }, []);

  // ── Load messages for a channel ─────────────────────────────
  const loadMessages = useCallback(async (channelId: string) => {
    setLoadingMsgs(true);
    setMessages([]);
    lastMessageId.current = null;

    try {
      const res  = await fetch(`/api/chat/messages?channel=${channelId}`);
      const data = await res.json() as MessageRow[];
      if (Array.isArray(data)) {
        const msgs = data.map(rowToMessage);
        setMessages(msgs);
        lastMessageId.current = msgs.at(-1)?.id ?? null;
      }
    } catch (e) {
      console.error("[chat] messages:", e);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    loadMessages(activeChannel);
  }, [activeChannel, loadMessages]);

  // ── Poll for new messages every 3s ─────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/chat/messages?channel=${activeChannel}`);
        const data = await res.json() as MessageRow[];
        if (!Array.isArray(data)) return;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = data
            .map(rowToMessage)
            .filter((m) => !existingIds.has(m.id) && !m.id.startsWith("opt-"));
          if (newMsgs.length === 0) return prev;
          // Replace any matching optimistic messages, append the rest
          const withoutOptimistic = prev.filter((m) => {
            if (!m.id.startsWith("opt-")) return true;
            return !newMsgs.some((n) => n.user === m.user && n.text === m.text);
          });
          return [...withoutOptimistic, ...newMsgs];
        });
      } catch { /* silent — polling failure is not fatal */ }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeChannel]);

  // ── Send message ────────────────────────────────────────────
  async function handleSend(text: string) {
    const optimisticId = `opt-${Date.now()}`;

    // Show immediately
    setMessages((prev) => [
      ...prev,
      {
        id:        optimisticId,
        channel:   activeChannel,
        timestamp: nowTimestamp(),
        user:      session.name.toLowerCase(),
        text,
        type:      "message",
      },
    ]);

    try {
      const res = await fetch("/api/chat/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ channelId: activeChannel, text }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error("[chat] send:", e);
      // Roll back optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }
  }

  const channelMeta = channels.find((c) => c.id === activeChannel);
  const headerLabel = channelMeta?.label ?? `@${activeChannel}`;
  const headerTopic = channelMeta?.topic ?? "direct message";

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSidebar
        channels={channels}
        activeChannel={activeChannel}
        onSelect={setActiveChannel}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg">
        {/* Channel header */}
        <div className="h-9 shrink-0 flex items-center px-4 border-b border-zk-border bg-zk-surface/30">
          <span className="font-mono text-xs text-zk-green tracking-widest">
            {headerLabel}
          </span>
          <span className="ml-3 font-mono text-[10px] text-zk-muted/50 tracking-wide">
            — {headerTopic}
          </span>
          {loadingMsgs && (
            <span className="ml-auto font-mono text-[9px] text-zk-muted/40 tracking-widest animate-pulse">
              LOADING...
            </span>
          )}
        </div>

        <MessageLog messages={messages} />
        <CliInput channelLabel={headerLabel} onSend={handleSend} />
      </div>
    </div>
  );
}
