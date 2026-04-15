// components/system/chat/ChatSidebar.tsx
// Redesigned sidebar: channels with lock states, DMs with last-message
// preview + timestamps, inline user search.

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Plus, Lock, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Channel, type DMConversation } from "./types";

// ─── Status dot ───────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  ONLINE:  "bg-zk-green shadow-glow-sm",
  AWAY:    "bg-zk-amber",
  OFFLINE: "bg-zk-muted/30",
};

interface SearchResult {
  id:       string;
  username: string;
  name:     string;
  email:    string;
  status:   string;
}

interface ChatSidebarProps {
  channels:        Channel[];
  activeChannel:   string;
  onSelect:        (id: string, type: "channel" | "dm", dmUserId?: string, dmHandle?: string) => void;
  dmConvos:        DMConversation[];
  activeDmUser?:   string;
  onRefreshDms:    () => void;
  loadingChannels?: boolean;
  loadingDms?:      boolean;
  presence?:        Record<string, "ONLINE" | "OFFLINE">;
}

// ─── Skeletons ────────────────────────────────────────────────
function SkeletonChannels() {
  const widths = ["w-24", "w-20", "w-28", "w-16"];
  return (
    <div className="px-2 flex flex-col gap-px animate-pulse">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-sm border border-transparent">
          <div className="w-3 h-3 rounded-sm bg-zk-border/25 shrink-0" />
          <div className={cn("h-2.5 rounded-sm bg-zk-border/20", w)} />
        </div>
      ))}
    </div>
  );
}

function SkeletonDms() {
  const rows = [
    { handle: "w-20", preview: "w-32" },
    { handle: "w-16", preview: "w-28" },
    { handle: "w-24", preview: "w-20" },
  ];
  return (
    <div className="px-2 flex flex-col gap-px animate-pulse">
      {rows.map((r, i) => (
        <div key={i} className="px-2.5 py-2 rounded-sm border border-transparent">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-zk-border/25 shrink-0" />
            <div className={cn("h-2.5 rounded-sm bg-zk-border/25", r.handle)} />
          </div>
          <div className={cn("h-2 rounded-sm bg-zk-border/15 ml-3.5", r.preview)} />
        </div>
      ))}
    </div>
  );
}

// ─── Relative time ────────────────────────────────────────────
function relativeTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "now";
  if (mins < 60)  return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Section label ────────────────────────────────────────────
function SectionLabel({
  children, action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-5 pb-1.5">
      <span className="font-mono text-[9px] text-zk-muted/40 tracking-[0.25em] uppercase">
        {children}
      </span>
      {action}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export function ChatSidebar({
  channels, activeChannel, onSelect, dmConvos, activeDmUser, onRefreshDms,
  loadingChannels, loadingDms, presence = {},
}: ChatSidebarProps) {
  const [searching,     setSearching]     = useState(false);
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searching) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searching]);

  useEffect(() => {
    if (!searching || query.length < 1) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res  = await fetch(`/api/chat/users-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (Array.isArray(data)) setResults(data);
      } catch { /* silent */ }
      finally { setLoadingSearch(false); }
    }, 300);
  }, [query, searching]);

  function openDM(user: SearchResult) {
    setSearching(false);
    setQuery("");
    setResults([]);
    // Pass the handle so the parent injects a placeholder immediately.
    // Do NOT call onRefreshDms here — the server has no record of this
    // conversation yet (no messages sent), so it would overwrite the
    // placeholder and produce "@unknown" in the header.
    onSelect(`dm:${user.id}`, "dm", user.id, user.username);
  }

  function closeSearch() {
    setSearching(false);
    setQuery("");
    setResults([]);
  }

  return (
    <aside className={cn(
      "w-56 shrink-0 flex flex-col overflow-hidden",
      "border-r border-zk-border bg-[rgba(13,17,23,0.6)]",
    )}>

      {/* ── Wordmark ──────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-zk-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zk-green shadow-glow-sm animate-pulse shrink-0" />
          <span className="font-mono text-[10px] text-zk-green/70 tracking-[0.25em] uppercase">
            Comms
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* ── Channels ──────────────────────────────────── */}
        <SectionLabel>Channels</SectionLabel>
        {loadingChannels ? <SkeletonChannels /> : <div className="px-2 flex flex-col gap-px">
          {channels.map((ch) => {
            const active  = activeChannel === ch.id && !activeDmUser;
            const canView = ch.permissions.includes(`view:${ch.id}`);

            return (
              <button
                key={ch.id}
                onClick={() => canView && onSelect(ch.id, "channel")}
                disabled={!canView}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-sm text-left",
                  "transition-all duration-150 group",
                  active
                    ? "bg-zk-green/10 border border-zk-green/20 shadow-[inset_2px_0_0_#00FF41]"
                    : canView
                      ? "border border-transparent hover:bg-zk-green/5 hover:border-zk-border/60"
                      : "border border-transparent opacity-35 cursor-not-allowed",
                )}
              >
                {/* Icon */}
                <span className={cn(
                  "shrink-0 transition-colors",
                  active ? "text-zk-green" : canView ? "text-zk-muted/50" : "text-zk-muted/30"
                )}>
                  {canView ? <Hash size={12} /> : <Lock size={11} />}
                </span>

                {/* Label */}
                <span className={cn(
                  "font-mono text-[11px] tracking-wide truncate flex-1",
                  active ? "text-zk-green" : "text-zk-slate"
                )}>
                  {ch.label.replace("#", "")}
                </span>

                {/* Unread badge */}
                {ch.unread > 0 && !active && canView && (
                  <span className="shrink-0 font-mono text-[9px] leading-none bg-zk-green text-zk-bg px-1.5 py-0.5 rounded-sm">
                    {ch.unread}
                  </span>
                )}

                {/* Members */}
                {active && ch.memberCount > 0 && (
                  <span className="shrink-0 font-mono text-[9px] text-zk-green/50">
                    {ch.memberCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>}

        {/* ── Direct Messages ───────────────────────────── */}
        <SectionLabel
          action={
            <button
              onClick={() => setSearching((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-sm",
                "font-mono text-[9px] tracking-wider transition-all",
                searching
                  ? "text-zk-green bg-zk-green/10 border border-zk-green/20"
                  : "text-zk-muted/40 hover:text-zk-green border border-transparent hover:border-zk-border/50"
              )}
              aria-label="New direct message"
            >
              <Plus size={9} />
              <span>New</span>
            </button>
          }
        >
          Direct
        </SectionLabel>

        {/* Search panel */}
        {searching && (
          <div className="mx-2 mb-2 rounded-sm border border-zk-border/60 bg-zk-surface/60 overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-zk-border/40">
              <Search size={10} className="text-zk-muted/50 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="username, name or email..."
                className={cn(
                  "flex-1 bg-transparent outline-none",
                  "font-mono text-[10px] text-zk-white placeholder:text-zk-muted/30",
                  "caret-zk-green"
                )}
              />
              <button onClick={closeSearch} className="text-zk-muted/40 hover:text-zk-white shrink-0">
                <X size={10} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-40 overflow-y-auto">
              {loadingSearch && (
                <p className="font-mono text-[9px] text-zk-muted/40 px-3 py-2 animate-pulse">
                  Searching...
                </p>
              )}
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openDM(u)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zk-green/8 transition-colors text-left border-b border-zk-border/20 last:border-0"
                >
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    STATUS_DOT[u.status] ?? STATUS_DOT.OFFLINE
                  )} />
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-zk-white truncate leading-tight">{u.name}</p>
                    <p className="font-mono text-[9px] text-zk-muted/50 truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
              {query.length > 0 && !loadingSearch && results.length === 0 && (
                <p className="font-mono text-[9px] text-zk-muted/30 px-3 py-2">No users found</p>
              )}
            </div>
          </div>
        )}

        {/* DM list */}
        {loadingDms ? <SkeletonDms /> : <div className="px-2 flex flex-col gap-px">
          {dmConvos.length === 0 && !searching && (
            <p className="font-mono text-[9px] text-zk-muted/25 px-2.5 py-1.5 italic">
              No conversations yet
            </p>
          )}
          {dmConvos.map((dm) => {
            const active = activeDmUser === dm.userId;
            return (
              <button
                key={dm.userId}
                onClick={() => onSelect(`dm:${dm.userId}`, "dm", dm.userId)}
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-sm",
                  "transition-all duration-150",
                  active
                    ? "bg-zk-green/10 border border-zk-green/20 shadow-[inset_2px_0_0_#00FF41]"
                    : "border border-transparent hover:bg-zk-green/5 hover:border-zk-border/60"
                )}
              >
                {/* Top row: handle + time */}
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Live presence dot */}
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300",
                      presence[dm.userId] === "ONLINE"
                        ? active ? "bg-zk-green shadow-glow-sm" : "bg-zk-green"
                        : "bg-zk-muted/30",
                    )} />
                    <span className={cn(
                      "font-mono text-[11px] truncate",
                      active ? "text-zk-green" : dm.unread > 0 ? "text-zk-white font-semibold" : "text-zk-slate"
                    )}>
                      {dm.handle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {dm.unread > 0 && !active && (
                      <span className="font-mono text-[9px] leading-none bg-zk-green text-zk-bg px-1 py-0.5 rounded-sm">
                        {dm.unread}
                      </span>
                    )}
                    {dm.lastTime && (
                      <span className="font-mono text-[9px] text-zk-muted/30">
                        {relativeTime(dm.lastTime)}
                      </span>
                    )}
                  </div>
                </div>
                {/* Last message preview */}
                {dm.lastMsg && (
                  <p className={cn(
                    "font-mono text-[10px] truncate pl-3.5",
                    active ? "text-zk-green/50" : "text-zk-muted/40"
                  )}>
                    {dm.lastMsg}
                  </p>
                )}
              </button>
            );
          })}
        </div>}
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zk-border/40">
        <span className="font-mono text-[9px] text-zk-muted/25 tracking-widest">
          AES-256 · E2E ENCRYPTED
        </span>
      </div>
    </aside>
  );
}
