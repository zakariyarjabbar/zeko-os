// components/system/chat/ChatSidebar.tsx
// Left panel: encrypted channels list + direct messages.
// Channels are passed as props (fetched from Supabase in the page).
// DMs are still static for now — Phase 4 when needed.

"use client";

import { cn } from "@/lib/utils";
import { type Channel } from "./types";

// ─── Static DM type (not yet in DB) ──────────────────────────
interface DMUser {
  id:     string;
  handle: string;
  status: "online" | "away" | "offline";
  unread: number;
}

const DM_USERS: DMUser[] = [
  { id: "dm-nova",   handle: "n.cross",   status: "online", unread: 0 },
  { id: "dm-cipher", handle: "c.wraight", status: "away",   unread: 0 },
];

const STATUS_COLOR: Record<DMUser["status"], string> = {
  online:  "bg-zk-green shadow-glow-sm",
  away:    "bg-zk-amber",
  offline: "bg-zk-muted/40",
};

// ─── Props ────────────────────────────────────────────────────
interface ChatSidebarProps {
  channels:      Channel[];
  activeChannel: string;
  onSelect:      (id: string) => void;
}

// ─── Section label ────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="font-mono text-[9px] text-zk-muted/50 tracking-[0.2em] uppercase">
        {children}
      </span>
    </div>
  );
}

// ─── Channel row ──────────────────────────────────────────────
function ChannelRow({
  channel, active, onSelect,
}: {
  channel: Channel; active: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center justify-between px-3 py-1.5 rounded-sm text-left",
        "font-mono text-[11px] tracking-wide transition-all duration-150",
        active
          ? "bg-zk-green/10 text-zk-green border-l-2 border-zk-green"
          : "text-zk-slate border-l-2 border-transparent hover:text-zk-white hover:bg-zk-green/5"
      )}
    >
      <span className="truncate">{channel.label}</span>
      {channel.unread > 0 && !active && (
        <span className="ml-1 shrink-0 font-mono text-[9px] text-zk-bg bg-zk-green rounded-sm px-1 leading-4">
          {channel.unread}
        </span>
      )}
    </button>
  );
}

// ─── DM row ───────────────────────────────────────────────────
function DMRow({
  user, active, onSelect,
}: {
  user: DMUser; active: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 rounded-sm text-left",
        "font-mono text-[11px] tracking-wide transition-all duration-150",
        active
          ? "bg-zk-green/10 text-zk-green border-l-2 border-zk-green"
          : "text-zk-slate border-l-2 border-transparent hover:text-zk-white hover:bg-zk-green/5"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_COLOR[user.status])} aria-hidden="true" />
      <span className="truncate flex-1">{user.handle}</span>
      {user.unread > 0 && !active && (
        <span className="shrink-0 font-mono text-[9px] text-zk-bg bg-zk-green rounded-sm px-1 leading-4">
          {user.unread}
        </span>
      )}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────
export function ChatSidebar({ channels, activeChannel, onSelect }: ChatSidebarProps) {
  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-zk-border bg-zk-surface/40 overflow-y-auto">

      {/* ── Top label ──────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 border-b border-zk-border/50">
        <span className="font-mono text-[10px] text-zk-green/60 tracking-widest uppercase">
          // COMMS
        </span>
      </div>

      {/* ── Channels ───────────────────────────────────────── */}
      <SectionLabel>Encrypted Channels</SectionLabel>
      <div className="flex flex-col gap-0.5 px-1">
        {channels.map((ch) => (
          <ChannelRow
            key={ch.id}
            channel={ch}
            active={activeChannel === ch.id}
            onSelect={() => onSelect(ch.id)}
          />
        ))}
      </div>

      {/* ── Direct Messages ────────────────────────────────── */}
      <SectionLabel>Direct Messages</SectionLabel>
      <div className="flex flex-col gap-0.5 px-1">
        {DM_USERS.map((u) => (
          <DMRow
            key={u.id}
            user={u}
            active={activeChannel === u.id}
            onSelect={() => onSelect(u.id)}
          />
        ))}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="mt-auto px-3 py-3 border-t border-zk-border/50">
        <span className="font-mono text-[9px] text-zk-muted/30 tracking-widest">
          E2E ENCRYPTED · AES-256
        </span>
      </div>
    </aside>
  );
}
