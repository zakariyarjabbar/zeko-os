// app/system/chat/page.tsx
// IRC/ops-terminal chat interface.
// Left:  ChatSidebar  (channels + DMs)
// Right: MessageLog (scrollable) + CliInput (pinned bottom)

"use client";

import { useState, useMemo } from "react";
import { ChatSidebar } from "@/components/system/chat/ChatSidebar";
import { MessageLog }  from "@/components/system/chat/MessageLog";
import { CliInput }    from "@/components/system/chat/CliInput";
import { useSession }  from "@/components/system/SessionContext";
import {
  CHANNELS,
  MOCK_MESSAGES,
  type ChatMessage,
} from "@/components/system/chat/mock-data";

// Current time as HH:MM:SS
function nowTimestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

export default function ChatPage() {
  const session = useSession();
  const [activeChannel, setActiveChannel] = useState("global-ops");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  // Merge mock + local, filtered to active channel
  const messages = useMemo(() => {
    const base  = MOCK_MESSAGES.filter((m) => m.channel === activeChannel);
    const local = localMessages.filter((m) => m.channel === activeChannel);
    return [...base, ...local];
  }, [activeChannel, localMessages]);

  // Channel header metadata
  const channelMeta = CHANNELS.find((c) => c.id === activeChannel);
  const headerLabel = channelMeta ? channelMeta.label : `@${activeChannel}`;
  const headerTopic = channelMeta ? channelMeta.topic : "direct message";

  function handleSend(text: string) {
    const msg: ChatMessage = {
      id:        `local-${Date.now()}`,
      channel:   activeChannel,
      timestamp: nowTimestamp(),
      user:      session.name.toLowerCase(),
      text,
      type:      "message",
    };
    setLocalMessages((prev) => [...prev, msg]);
  }

  // When switching channels, clear unread badges (future: could persist)
  function handleSelectChannel(id: string) {
    setActiveChannel(id);
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar ──────────────────────────────────── */}
      <ChatSidebar
        activeChannel={activeChannel}
        onSelect={handleSelectChannel}
      />

      {/* ── Main chat area ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg">

        {/* Channel header */}
        <div className="h-9 shrink-0 flex items-center px-4 border-b border-zk-border bg-zk-surface/30">
          <span className="font-mono text-xs text-zk-green tracking-widest">
            {headerLabel}
          </span>
          <span className="ml-3 font-mono text-[10px] text-zk-muted/50 tracking-wide">
            — {headerTopic}
          </span>
        </div>

        {/* Message log */}
        <MessageLog messages={messages} />

        {/* CLI input */}
        <CliInput
          channelLabel={headerLabel}
          onSend={handleSend}
        />

      </div>
    </div>
  );
}
