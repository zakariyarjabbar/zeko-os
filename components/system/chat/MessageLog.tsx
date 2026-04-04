// components/system/chat/MessageLog.tsx
// Renders messages as continuous terminal log lines.
// Format: [HH:MM:SS] <user>: message

"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { type ChatMessage } from "./types";

interface MessageLogProps {
  messages: ChatMessage[];
}

// ─── Single log line ──────────────────────────────────────────
function LogLine({ msg }: { msg: ChatMessage }) {
  const isSystem = msg.type === "system";

  if (isSystem) {
    return (
      <div className="flex items-start gap-0 leading-relaxed py-0.5 group">
        {/* Timestamp */}
        <span className="font-mono text-[11px] text-zk-muted/50 shrink-0 mr-2 select-none">
          [{msg.timestamp}]
        </span>
        {/* System message — amber, italic feel */}
        <span className="font-mono text-[11px] text-zk-amber/70 italic">
          *** {msg.text}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-0 leading-relaxed py-0.5 group hover:bg-zk-green/[0.02] -mx-4 px-4 transition-colors duration-100">
      {/* Timestamp */}
      <span className="font-mono text-[11px] text-zk-muted/50 shrink-0 mr-2 select-none">
        [{msg.timestamp}]
      </span>
      {/* Username */}
      <span className="font-mono text-[11px] text-zk-green font-medium shrink-0 mr-0">
        &lt;{msg.user}&gt;
      </span>
      {/* Separator */}
      <span className="font-mono text-[11px] text-zk-muted/40 shrink-0 mx-1 select-none">
        :
      </span>
      {/* Message body */}
      <span className="font-mono text-[11px] text-zk-slate/90 break-words min-w-0">
        {msg.text}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export function MessageLog({ messages }: MessageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-[10px] text-zk-muted/30 tracking-widest">
          NO MESSAGES IN THIS CHANNEL
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
      {/* Date separator */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-zk-border/50" />
        <span className="font-mono text-[9px] text-zk-muted/40 tracking-widest select-none">
          TODAY
        </span>
        <div className="flex-1 h-px bg-zk-border/50" />
      </div>

      {messages.map((msg) => (
        <LogLine key={msg.id} msg={msg} />
      ))}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
