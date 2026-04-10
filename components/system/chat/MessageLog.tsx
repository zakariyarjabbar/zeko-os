// components/system/chat/MessageLog.tsx
// Grouped message log — consecutive messages from the same user
// within 5 minutes are collapsed into a single visual group.
// First message shows avatar initial + username + timestamp.
// Continuation messages show body only, indented.

"use client";

import { useEffect, useRef, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ChatMessage } from "./types";

interface MessageLogProps {
  messages:  ChatMessage[];
  canDelete: boolean;
  onDelete:  (id: string) => void;
  currentUserId: string;
  loading?:  boolean;
}

// ─── Message grouping ─────────────────────────────────────────
const GROUP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface MessageGroup {
  id:        string; // first message id
  user:      string;
  userId:    string;
  timestamp: string; // display timestamp of first message
  isoTime:   string; // for grouping logic
  messages:  ChatMessage[];
  type:      "message" | "system";
}

function buildGroups(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const msg of messages) {
    if (msg.type === "system") {
      groups.push({
        id:        msg.id,
        user:      "SYSTEM",
        userId:    "",
        timestamp: msg.timestamp,
        isoTime:   msg.timestamp,
        messages:  [msg],
        type:      "system",
      });
      continue;
    }

    const last = groups[groups.length - 1];
    const msgTime = parseTimestamp(msg.timestamp);
    const lastTime = last ? parseTimestamp(last.timestamp) : 0;
    const sameUser = last && last.user === msg.user && last.type === "message";
    const withinThreshold = sameUser && (msgTime - lastTime) < GROUP_THRESHOLD_MS;

    if (withinThreshold) {
      last.messages.push(msg);
    } else {
      groups.push({
        id:        msg.id,
        user:      msg.user,
        userId:    msg.userId,
        timestamp: msg.timestamp,
        isoTime:   msg.timestamp,
        messages:  [msg],
        type:      "message",
      });
    }
  }

  return groups;
}

// HH:MM:SS → comparable ms (same-day approximation)
function parseTimestamp(ts: string): number {
  const [h, m, s] = ts.split(":").map(Number);
  return (h * 3600 + m * 60 + (s || 0)) * 1000;
}

// HH:MM:SS → HH:MM
function shortTime(ts: string): string {
  return ts.slice(0, 5);
}

// Username initial
function initial(name: string): string {
  return (name?.[0] ?? "?").toUpperCase();
}

// Avatar color from username (deterministic)
const AVATAR_COLORS = [
  "bg-zk-green/20 text-zk-green border-zk-green/30",
  "bg-zk-cyan/15 text-zk-cyan border-zk-cyan/25",
  "bg-zk-amber/15 text-zk-amber border-zk-amber/25",
  "bg-zk-muted/20 text-zk-slate border-zk-muted/30",
];

function avatarColor(name: string): string {
  const code = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ─── System message ───────────────────────────────────────────
function SystemLine({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex items-center gap-3 py-2 my-1">
      <div className="flex-1 h-px bg-zk-amber/15" />
      <span className="font-mono text-[10px] text-zk-amber/50 tracking-wider px-2">
        *** {msg.text}
      </span>
      <div className="flex-1 h-px bg-zk-amber/15" />
    </div>
  );
}

// ─── Message group ────────────────────────────────────────────
function MessageGroupBlock({
  group, canDelete, onDelete, isOwnGroup,
}: {
  group:       MessageGroup;
  canDelete:   boolean;
  onDelete:    (id: string) => void;
  isOwnGroup:  boolean;
}) {
  const color = avatarColor(group.user);

  return (
    <div className="flex items-start gap-3 py-1 group/block">
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-sm shrink-0 flex items-center justify-center mt-0.5",
        "border text-[11px] font-mono font-bold select-none",
        color,
      )}>
        {initial(group.user)}
      </div>

      {/* Messages */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={cn(
            "font-mono text-[12px] font-semibold",
            isOwnGroup ? "text-zk-green" : "text-zk-white"
          )}>
            {group.user}
          </span>
          <span className="font-mono text-[10px] text-zk-muted/40 select-none">
            {shortTime(group.timestamp)}
          </span>
        </div>

        {/* Message lines */}
        {group.messages.map((msg, i) => (
          <div
            key={msg.id}
            className={cn(
              "group/msg flex items-start gap-2",
              i > 0 && "mt-0.5"
            )}
          >
            <span className={cn(
              "font-mono text-[12px] text-zk-white/90 leading-relaxed break-words min-w-0 flex-1",
              msg.id.startsWith("opt-") && "opacity-50"
            )}>
              {msg.text}
            </span>

            {/* Per-message actions */}
            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-100">
              {/* Precise timestamp on hover */}
              <span className="font-mono text-[9px] text-zk-muted/30 select-none">
                {msg.timestamp}
              </span>

              {/* Delete */}
              {canDelete && !msg.id.startsWith("opt-") && (
                <button
                  onClick={() => onDelete(msg.id)}
                  aria-label="Delete message"
                  className="p-0.5 rounded-sm text-zk-muted/30 hover:text-zk-red hover:bg-zk-red/10 transition-colors"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Date separator ───────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-zk-border/40" />
      <span className="font-mono text-[9px] text-zk-muted/35 tracking-[0.2em] uppercase select-none px-1">
        {label}
      </span>
      <div className="flex-1 h-px bg-zk-border/40" />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────
const SKELETON_ROWS: { lines: string[] }[] = [
  { lines: ["w-2/3", "w-1/2"] },
  { lines: ["w-4/5"] },
  { lines: ["w-1/2", "w-3/4", "w-2/5"] },
  { lines: ["w-3/5"] },
  { lines: ["w-4/5", "w-1/3"] },
];

function SkeletonLog() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 animate-pulse">
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-zk-border/20" />
        <div className="h-2 w-8 rounded-sm bg-zk-border/20" />
        <div className="flex-1 h-px bg-zk-border/20" />
      </div>

      {SKELETON_ROWS.map((row, i) => (
        <div key={i} className="flex items-start gap-3 py-1">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-sm shrink-0 mt-0.5 bg-zk-border/25 border border-zk-border/20" />

          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Header: name + timestamp */}
            <div className="flex items-baseline gap-2">
              <div className="h-2.5 w-20 rounded-sm bg-zk-border/30" />
              <div className="h-2 w-8 rounded-sm bg-zk-border/20" />
            </div>

            {/* Message lines */}
            {row.lines.map((w, j) => (
              <div key={j} className={cn("h-2.5 rounded-sm bg-zk-border/20", w)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Date label ───────────────────────────────────────────────
function dateLabel(isoDate: string): string {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (isoDate === today)     return "Today";
  if (isoDate === yesterday) return "Yesterday";
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────
export function MessageLog({
  messages, canDelete, onDelete, currentUserId, loading,
}: MessageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Produce a flat list of { kind: "separator" | "group" } items grouped by date
  const items = useMemo(() => {
    type Item =
      | { kind: "separator"; date: string }
      | { kind: "group";     group: MessageGroup };

    const byDate = new Map<string, ChatMessage[]>();
    for (const msg of messages) {
      const d = msg.date ?? new Date().toISOString().slice(0, 10);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(msg);
    }

    const result: Item[] = [];
    for (const [date, msgs] of [...byDate.entries()].sort()) {
      result.push({ kind: "separator", date });
      for (const group of buildGroups(msgs)) {
        result.push({ kind: "group", group });
      }
    }
    return result;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) return <SkeletonLog />;

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <span className="font-mono text-3xl text-zk-border select-none">⬚</span>
        <span className="font-mono text-[10px] text-zk-muted/30 tracking-widest">
          NO MESSAGES
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {items.map((item) => {
        if (item.kind === "separator") {
          return <DateSeparator key={`sep-${item.date}`} label={dateLabel(item.date)} />;
        }
        const { group } = item;
        if (group.type === "system") {
          return <SystemLine key={group.id} msg={group.messages[0]} />;
        }
        return (
          <MessageGroupBlock
            key={group.id}
            group={group}
            canDelete={canDelete}
            onDelete={onDelete}
            isOwnGroup={group.userId === currentUserId}
          />
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
