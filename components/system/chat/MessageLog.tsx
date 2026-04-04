// components/system/chat/MessageLog.tsx
// Renders messages as terminal log lines.
// Shows delete button on hover if canDelete is true.

"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ChatMessage } from "./types";

interface MessageLogProps {
  messages:  ChatMessage[];
  canDelete: boolean;
  onDelete:  (id: string) => void;
}

function LogLine({
  msg, canDelete, onDelete,
}: {
  msg: ChatMessage; canDelete: boolean; onDelete: (id: string) => void;
}) {
  const isSystem = msg.type === "system";

  if (isSystem) {
    return (
      <div className="flex items-start leading-relaxed py-0.5">
        <span className="font-mono text-[11px] text-zk-muted/50 shrink-0 mr-2 select-none">
          [{msg.timestamp}]
        </span>
        <span className="font-mono text-[11px] text-zk-amber/70 italic">
          *** {msg.text}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-start leading-relaxed py-0.5 group",
      "-mx-4 px-4 transition-colors duration-100",
      "hover:bg-zk-green/[0.02]",
    )}>
      <span className="font-mono text-[11px] text-zk-muted/50 shrink-0 mr-2 select-none">
        [{msg.timestamp}]
      </span>
      <span className="font-mono text-[11px] text-zk-green font-medium shrink-0">
        &lt;{msg.user}&gt;
      </span>
      <span className="font-mono text-[11px] text-zk-muted/40 shrink-0 mx-1 select-none">:</span>
      <span className="font-mono text-[11px] text-zk-slate/90 break-words min-w-0 flex-1">
        {msg.text}
      </span>

      {/* Delete button — visible on hover if permitted */}
      {canDelete && !msg.id.startsWith("opt-") && (
        <button
          onClick={() => onDelete(msg.id)}
          aria-label="Delete message"
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity duration-100",
            "ml-2 shrink-0 p-0.5 rounded-sm",
            "text-zk-muted/40 hover:text-zk-red hover:bg-zk-red/10",
          )}
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

export function MessageLog({ messages, canDelete, onDelete }: MessageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-[10px] text-zk-muted/30 tracking-widest">
          NO MESSAGES
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-zk-border/50" />
        <span className="font-mono text-[9px] text-zk-muted/40 tracking-widest select-none">TODAY</span>
        <div className="flex-1 h-px bg-zk-border/50" />
      </div>
      {messages.map((msg) => (
        <LogLine key={msg.id} msg={msg} canDelete={canDelete} onDelete={onDelete} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
