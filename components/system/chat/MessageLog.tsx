// components/system/chat/MessageLog.tsx
// Grouped message log — consecutive messages from the same user
// within 5 minutes are collapsed into a single visual group.
//
// Display names are resolved live from `userProfiles` so renaming
// a user is reflected immediately without stale handles.
// Clicking an avatar or name opens a small UserProfileCard popover.

"use client";

import { useEffect, useRef, useMemo, useState, useCallback, memo } from "react";
import { Trash2 }            from "lucide-react";
import { cn }                from "@/lib/utils";
import { type ChatMessage }  from "./types";
import { UserProfileCard }   from "./UserProfileCard";

// ─── Props ────────────────────────────────────────────────────
interface MessageLogProps {
  messages:      ChatMessage[];
  canDelete:     boolean;
  onDelete:      (id: string) => void;
  currentUserId: string;
  loading?:      boolean;
  /** Current resolved display names: userId → { displayName, username } */
  userProfiles?: Record<string, { displayName: string; username: string }>;
  /** Live online/offline map used in the profile popover */
  presence?:     Record<string, "ONLINE" | "OFFLINE">;
  /** Called when the user clicks "Send Direct Message" inside the popover */
  onOpenDm?:    (userId: string, username: string) => void;
  /**
   * Changes whenever the active channel/DM switches.
   * Used to reset the "seen ids" tracker so animations don't carry over.
   */
  conversationKey?: string;
}

// ─── Message grouping ─────────────────────────────────────────
const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

interface MessageGroup {
  id:        string;
  user:      string;   // stored handle (fallback only)
  userId:    string;
  timestamp: string;
  isoTime:   string;
  messages:  ChatMessage[];
  type:      "message" | "system";
}

function buildGroups(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const msg of messages) {
    if (msg.type === "system") {
      groups.push({
        id: msg.id, user: "SYSTEM", userId: "",
        timestamp: msg.timestamp, isoTime: msg.timestamp,
        messages: [msg], type: "system",
      });
      continue;
    }

    const last         = groups[groups.length - 1];
    const msgTime      = parseTimestamp(msg.timestamp);
    const lastTime     = last ? parseTimestamp(last.timestamp) : 0;
    // Group by userId (not stored handle) so renames don't break grouping
    const sameUser     = last && last.userId === msg.userId && last.type === "message";
    const withinWindow = sameUser && (msgTime - lastTime) < GROUP_THRESHOLD_MS;

    if (withinWindow) {
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

function shortTime(ts: string): string { return ts.slice(0, 5); }

// ─── Avatar helpers ───────────────────────────────────────────
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

function initial(name: string): string {
  return (name?.[0] ?? "?").toUpperCase();
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
interface MessageGroupBlockProps {
  group:        MessageGroup;
  displayName:  string;   // resolved current name
  canDelete:    boolean;
  onDelete:     (id: string) => void;
  isOwnGroup:   boolean;
  onAvatarClick: (e: React.MouseEvent) => void;
  newIds:       Set<string>;
}

function MessageGroupBlock({
  group, displayName, canDelete, onDelete, isOwnGroup, onAvatarClick, newIds,
}: MessageGroupBlockProps) {
  const color = avatarColor(group.userId);  // userId is stable even after renames

  return (
    <div className="flex items-start gap-3 py-1 group/block">
      {/* Clickable avatar */}
      <button
        onClick={onAvatarClick}
        aria-label={`View ${displayName}'s profile`}
        className={cn(
          "w-7 h-7 rounded-sm shrink-0 flex items-center justify-center mt-0.5",
          "border text-[11px] font-mono font-bold select-none",
          "transition-opacity duration-100 hover:opacity-75 cursor-pointer",
          color,
        )}
      >
        {initial(displayName)}
      </button>

      {/* Messages */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-baseline gap-2 mb-0.5">
          {/* Clickable username */}
          <button
            onClick={onAvatarClick}
            className={cn(
              "font-mono text-[12px] font-semibold leading-none cursor-pointer",
              "hover:underline underline-offset-2 transition-opacity hover:opacity-80",
              isOwnGroup ? "text-zk-green" : "text-zk-white"
            )}
          >
            {displayName}
          </button>
          <span className="font-mono text-[10px] text-zk-muted/40 select-none">
            {shortTime(group.timestamp)}
          </span>
        </div>

        {/* Message lines */}
        {group.messages.map((msg, i) => (
          <div
            key={msg.id}
            className={cn("group/msg flex items-start gap-2", i > 0 && "mt-0.5")}
          >
            <span className={cn(
              "font-mono text-[12px] text-zk-white/90 leading-relaxed break-words min-w-0 flex-1",
              msg.id.startsWith("opt-") && "opacity-50",
              newIds.has(msg.id) && "animate-msg-decode",
            )}>
              {msg.text}
            </span>

            {/* Per-message hover actions */}
            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-100">
              <span className="font-mono text-[9px] text-zk-muted/30 select-none">
                {msg.timestamp}
              </span>
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
const SKELETON_ROWS = [
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
          <div className="w-7 h-7 rounded-sm shrink-0 mt-0.5 bg-zk-border/25 border border-zk-border/20" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <div className="h-2.5 w-20 rounded-sm bg-zk-border/30" />
              <div className="h-2 w-8 rounded-sm bg-zk-border/20" />
            </div>
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

// ─── Popover state ────────────────────────────────────────────
interface PopoverState {
  userId:      string;
  displayName: string;
  username:    string;
  x:           number;
  y:           number;
}

// ─── Component ────────────────────────────────────────────────
export function MessageLog({
  messages, canDelete, onDelete, currentUserId, loading,
  userProfiles = {}, presence = {}, onOpenDm, conversationKey,
}: MessageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  // ── Decode-animation tracking ─────────────────────────────
  // seenIds holds every message ID that has already been rendered at least once.
  // On mount and on conversation switch, all current IDs are pre-seeded so
  // they never animate. Only IDs that arrive AFTER the initial render get the
  // msg-decode animation.
  const seenIds = useRef<Set<string>>(new Set());

  // Reset when the conversation changes (channel/DM switch)
  useEffect(() => {
    seenIds.current = new Set();
  }, [conversationKey]);

  // After every render, record all displayed IDs as seen
  useEffect(() => {
    messages.forEach((m) => seenIds.current.add(m.id));
  });

  // Compute which IDs are genuinely new THIS render cycle
  // (not yet in seenIds = arrived via SSE while page was open)
  const newIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of messages) {
      if (!seenIds.current.has(m.id) && !m.id.startsWith("opt-")) {
        s.add(m.id);
      }
    }
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]); // seenIds.current intentionally omitted — it's a mutable ref

  // Flat list of { separator | group } items grouped by date
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

  const handleAvatarClick = useCallback((
    e: React.MouseEvent,
    group: MessageGroup,
  ) => {
    e.stopPropagation();
    const profile = userProfiles[group.userId];
    setPopover({
      userId:      group.userId,
      displayName: profile?.displayName || group.user,
      username:    profile?.username    || group.user,
      x: e.clientX,
      y: e.clientY,
    });
  }, [userProfiles]);

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
    <>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {items.map((item) => {
          if (item.kind === "separator") {
            return <DateSeparator key={`sep-${item.date}`} label={dateLabel(item.date)} />;
          }
          const { group } = item;
          if (group.type === "system") {
            return <SystemLine key={group.id} msg={group.messages[0]} />;
          }

          // Resolve the current display name — fall back to stored handle
          const profile     = userProfiles[group.userId];
          const displayName = profile?.displayName || profile?.username || group.user;

          return (
            <MessageGroupBlock
              key={group.id}
              group={group}
              displayName={displayName}
              canDelete={canDelete}
              onDelete={onDelete}
              isOwnGroup={group.userId === currentUserId}
              onAvatarClick={(e) => handleAvatarClick(e, group)}
              newIds={newIds}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Profile popover */}
      {popover && (
        <UserProfileCard
          userId={popover.userId}
          displayName={popover.displayName}
          username={popover.username}
          isOnline={presence[popover.userId] === "ONLINE"}
          isSelf={popover.userId === currentUserId}
          anchorX={popover.x}
          anchorY={popover.y}
          onClose={() => setPopover(null)}
          onOpenDm={onOpenDm}
        />
      )}
    </>
  );
}
