// components/system/chat/MessageLog.tsx
// Grouped message log with:
//   • Inline message editing (own messages)
//   • "(edited)" label + admin edit-history popover
//   • DM read receipts (✓ sent, ✓✓ seen)
//   • @mention highlighting

"use client";

import {
  useEffect, useRef, useMemo, useState, useCallback,
} from "react";
import { Trash2, Pencil, Check, CheckCheck, X, Save }
  from "lucide-react";
import { cn }               from "@/lib/utils";
import { type ChatMessage } from "./types";
import { UserProfileCard }  from "./UserProfileCard";

// ─── Types ────────────────────────────────────────────────────
interface MessageLogProps {
  messages:      ChatMessage[];
  canDelete:     boolean;
  onDelete:      (id: string) => void;
  onEdit:        (id: string, text: string) => void;
  currentUserId: string;
  loading?:      boolean;
  userProfiles?: Record<string, { displayName: string; username: string }>;
  presence?:     Record<string, "ONLINE" | "OFFLINE">;
  onOpenDm?:    (userId: string, username: string) => void;
  isDm?:        boolean;
  conversationKey?: string;
  isAdmin?:     boolean;
}

// ─── Message grouping ─────────────────────────────────────────
const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

interface MessageGroup {
  id:        string;
  user:      string;
  userId:    string;
  timestamp: string;
  messages:  ChatMessage[];
  type:      "message" | "system";
}

function buildGroups(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const msg of messages) {
    if (msg.type === "system") {
      groups.push({
        id: msg.id, user: "SYSTEM", userId: "",
        timestamp: msg.timestamp,
        messages: [msg], type: "system",
      });
      continue;
    }

    const last         = groups[groups.length - 1];
    const msgTime      = parseTimestamp(msg.timestamp);
    const lastTime     = last ? parseTimestamp(last.timestamp) : 0;
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
        messages:  [msg],
        type:      "message",
      });
    }
  }

  return groups;
}

function parseTimestamp(ts: string): number {
  const [h, m, s] = ts.split(":").map(Number);
  return (h * 3600 + m * 60 + (s || 0)) * 1000;
}

function shortTime(ts: string): string { return ts.slice(0, 5); }

// ─── @mention highlight ───────────────────────────────────────
const MENTION_SPLIT = /(@[a-z][a-z0-9_-]{0,29})/gi;
const MENTION_TEST  = /^@[a-z][a-z0-9_-]{0,29}$/i;

function renderText(text: string): React.ReactNode {
  const parts = text.split(MENTION_SPLIT);
  return parts.map((part, i) =>
    MENTION_TEST.test(part)
      ? <span key={i} className="text-zk-amber/90 font-semibold">{part}</span>
      : <span key={i}>{part}</span>
  );
}

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

// ─── Edit-history popover ─────────────────────────────────────
interface EditEntry { id: string; old_body: string; new_body: string; edited_at: string }

function EditHistoryPopover({
  messageId, onClose,
}: { messageId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<EditEntry[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/chat/edits?messageId=${messageId}`)
      .then((r) => r.json())
      .then((d: EditEntry[]) => setEntries(d))
      .catch(() => setEntries([]));
  }, [messageId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 bottom-full mb-1 left-0",
        "w-72 bg-zk-surface border border-zk-border/60 rounded-sm shadow-xl p-2",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-sans text-[10px] text-zk-muted/50 uppercase tracking-wider">
          Edit history
        </span>
        <button onClick={onClose} className="text-zk-muted/30 hover:text-zk-white">
          <X size={10} />
        </button>
      </div>

      {entries === null ? (
        <p className="font-sans text-xs text-zk-muted/30 py-1">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="font-sans text-xs text-zk-muted/30 py-1">No history found.</p>
      ) : (
        entries.map((e) => (
          <div key={e.id} className="mb-2 last:mb-0">
            <p className="font-sans text-[10px] text-zk-muted/35 mb-0.5">
              {new Date(e.edited_at).toLocaleTimeString()}
            </p>
            <p className="font-mono text-[10px] text-zk-red/60 line-through leading-relaxed">
              {e.old_body}
            </p>
            <p className="font-mono text-[10px] text-zk-green/70 leading-relaxed">
              {e.new_body}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Single message line ──────────────────────────────────────
interface MessageLineProps {
  msg:        ChatMessage;
  isOwnGroup: boolean;
  isDm:       boolean;
  showDelete: boolean;
  onDelete:   (id: string) => void;
  onEdit:     (id: string, text: string) => void;
  newIds:     Set<string>;
  isAdmin:    boolean;
}

function MessageLine({
  msg, isOwnGroup, isDm, showDelete, onDelete, onEdit, newIds, isAdmin,
}: MessageLineProps) {
  const [editing,      setEditing]      = useState(false);
  const [editText,     setEditText]     = useState(msg.text);
  const [showHistory,  setShowHistory]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editText when msg.text changes externally (e.g. SSE update event)
  useEffect(() => {
    if (editing) return;
    const id = setTimeout(() => setEditText(msg.text), 0);
    return () => clearTimeout(id);
  }, [msg.text, editing]);

  function startEdit() {
    setEditText(msg.text);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(false);
    setEditText(msg.text);
  }

  function saveEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== msg.text) onEdit(msg.id, trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === "Escape") cancelEdit();
  }

  const isOptimistic = msg.id.startsWith("opt-");
  const canEdit = isOwnGroup && !isOptimistic;

  // Read receipts — only on own DM messages
  const showReceipt = isDm && isOwnGroup && !isOptimistic;

  if (editing) {
    return (
      <div className="mt-0.5 flex flex-col gap-1">
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full bg-zk-green/5 border border-zk-green/25 rounded-sm px-2 py-1",
            "font-mono text-[12px] text-zk-white outline-none caret-zk-green",
          )}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={saveEdit}
            disabled={!editText.trim()}
            className="flex items-center gap-1 font-sans text-[10px] text-zk-green/80 hover:text-zk-green disabled:opacity-30"
          >
            <Save size={9} /> save
          </button>
          <button
            onClick={cancelEdit}
            className="flex items-center gap-1 font-sans text-[10px] text-zk-muted/40 hover:text-zk-white"
          >
            <X size={9} /> cancel
          </button>
          <span className="font-sans text-[9px] text-zk-muted/20 select-none">
            Enter · Esc to cancel
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group/msg flex items-start gap-2")}>
      {/* Message text */}
      <span className={cn(
        "font-mono text-[12px] text-zk-white/90 leading-relaxed break-words min-w-0 flex-1",
        isOptimistic && "opacity-50",
        newIds.has(msg.id) && "animate-msg-decode",
      )}>
        {renderText(msg.text)}
        {msg.edited && (
          <span className="relative ml-1">
            {isAdmin ? (
              <>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="font-sans text-[9px] text-zk-muted/30 hover:text-zk-amber/60 transition-colors"
                >
                  (edited)
                </button>
                {showHistory && (
                  <EditHistoryPopover
                    messageId={msg.id}
                    onClose={() => setShowHistory(false)}
                  />
                )}
              </>
            ) : (
              <span className="font-sans text-[9px] text-zk-muted/30">(edited)</span>
            )}
          </span>
        )}
      </span>

      {/* Hover actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-100">
        <span className="font-sans text-xs text-zk-muted/30 select-none">
          {msg.timestamp}
        </span>

        {/* Edit button — own messages only */}
        {canEdit && (
          <button
            onClick={startEdit}
            aria-label="Edit message"
            className="p-0.5 rounded-sm text-zk-muted/30 hover:text-zk-cyan hover:bg-zk-cyan/10 transition-colors"
          >
            <Pencil size={10} />
          </button>
        )}

        {/* Delete button */}
        {showDelete && !isOptimistic && (
          <button
            onClick={() => onDelete(msg.id)}
            aria-label="Delete message"
            className="p-0.5 rounded-sm text-zk-muted/30 hover:text-zk-red hover:bg-zk-red/10 transition-colors"
          >
            <Trash2 size={10} />
          </button>
        )}

        {/* Read receipts */}
        {showReceipt && (
          <span className={cn(
            "transition-colors",
            msg.read ? "text-zk-cyan/60" : "text-zk-muted/25",
          )}>
            {msg.read
              ? <CheckCheck size={10} />
              : <Check size={10} />
            }
          </span>
        )}
      </div>
    </div>
  );
}

// ─── System message ───────────────────────────────────────────
function SystemLine({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex items-center gap-3 py-2 my-1">
      <div className="flex-1 h-px bg-zk-amber/15" />
      <span className="font-sans text-xs text-zk-amber/50 px-2">*** {msg.text}</span>
      <div className="flex-1 h-px bg-zk-amber/15" />
    </div>
  );
}

// ─── Message group ────────────────────────────────────────────
interface MessageGroupBlockProps {
  group:        MessageGroup;
  displayName:  string;
  canDelete:    boolean;
  onDelete:     (id: string) => void;
  onEdit:       (id: string, text: string) => void;
  isOwnGroup:   boolean;
  isDm:         boolean;
  onAvatarClick: (e: React.MouseEvent) => void;
  newIds:       Set<string>;
  isAdmin:      boolean;
}

function MessageGroupBlock({
  group, displayName, canDelete, onDelete, onEdit,
  isOwnGroup, isDm, onAvatarClick, newIds, isAdmin,
}: MessageGroupBlockProps) {
  const showDelete = isDm ? isOwnGroup : canDelete;
  const color = avatarColor(group.userId);

  return (
    <div className="flex items-start gap-3 py-1 group/block">
      <button
        onClick={onAvatarClick}
        aria-label={`View ${displayName}'s profile`}
        className={cn(
          "w-7 h-7 rounded shrink-0 flex items-center justify-center mt-0.5",
          "border text-[11px] font-mono font-bold select-none",
          "transition-opacity duration-100 hover:opacity-75 cursor-pointer",
          color,
        )}
      >
        {initial(displayName)}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <button
            onClick={onAvatarClick}
            className={cn(
              "font-sans text-sm font-semibold leading-none cursor-pointer",
              "hover:underline underline-offset-2 transition-opacity hover:opacity-80",
              isOwnGroup ? "text-zk-green" : "text-zk-white"
            )}
          >
            {displayName}
          </button>
          <span className="font-sans text-xs text-zk-muted/40 select-none">
            {shortTime(group.timestamp)}
          </span>
        </div>

        {group.messages.map((msg) => (
          <MessageLine
            key={msg.id}
            msg={msg}
            isOwnGroup={isOwnGroup}
            isDm={isDm}
            showDelete={showDelete}
            onDelete={onDelete}
            onEdit={onEdit}
            newIds={newIds}
            isAdmin={isAdmin}
          />
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
      <span className="font-sans text-xs text-zk-muted/35 uppercase tracking-wide select-none px-1">
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
  messages, canDelete, onDelete, onEdit, currentUserId, loading,
  userProfiles = {}, presence = {}, onOpenDm, isDm = false,
  conversationKey, isAdmin = false,
}: MessageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const id = setTimeout(() => setSeenIds(new Set()), 0);
    return () => clearTimeout(id);
  }, [conversationKey]);

  useEffect(() => {
    const id = setTimeout(() => {
      setSeenIds((prev) => {
        const next = new Set(prev);
        messages.forEach((m) => next.add(m.id));
        return next;
      });
    }, 0);
    return () => clearTimeout(id);
  }, [messages]);

  const newIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of messages) {
      if (!seenIds.has(m.id) && !m.id.startsWith("opt-")) s.add(m.id);
    }
    return s;
   
  }, [messages, seenIds]);

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
        <span className="text-3xl text-zk-border select-none">⬚</span>
        <span className="font-sans text-sm text-zk-muted/30">No messages</span>
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

          const profile     = userProfiles[group.userId];
          const displayName = profile?.displayName || profile?.username || group.user;

          return (
            <MessageGroupBlock
              key={group.id}
              group={group}
              displayName={displayName}
              canDelete={canDelete}
              onDelete={onDelete}
              onEdit={onEdit}
              isOwnGroup={group.userId === currentUserId}
              isDm={isDm}
              onAvatarClick={(e) => handleAvatarClick(e, group)}
              newIds={newIds}
              isAdmin={isAdmin}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

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
