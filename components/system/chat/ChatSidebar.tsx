// components/system/chat/ChatSidebar.tsx
// Left panel: channels + DMs with search.

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Channel, type DMConversation } from "./types";

const STATUS_COLOR: Record<string, string> = {
  ONLINE:  "bg-zk-green shadow-glow-sm",
  AWAY:    "bg-zk-amber",
  OFFLINE: "bg-zk-muted/40",
};

interface SearchResult {
  id: string; username: string; name: string; email: string; status: string;
}

interface ChatSidebarProps {
  channels:      Channel[];
  activeChannel: string;
  onSelect:      (id: string, type: "channel" | "dm", dmUserId?: string) => void;
  dmConvos:      DMConversation[];
  activeDmUser?: string;
  onRefreshDms:  () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="font-mono text-[9px] text-zk-muted/50 tracking-[0.2em] uppercase">
        {children}
      </span>
    </div>
  );
}

export function ChatSidebar({
  channels, activeChannel, onSelect, dmConvos, activeDmUser, onRefreshDms,
}: ChatSidebarProps) {
  const [searching,   setSearching]   = useState(false);
  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto focus search input
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  // Debounced search
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
    onSelect(`dm:${user.id}`, "dm", user.id);
    onRefreshDms();
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-zk-border bg-zk-surface/40 overflow-hidden">

      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-zk-border/50 shrink-0">
        <span className="font-mono text-[10px] text-zk-green/60 tracking-widest uppercase">
          // COMMS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Channels ─────────────────────────────────── */}
        <SectionLabel>Encrypted Channels</SectionLabel>
        <div className="flex flex-col gap-0.5 px-1">
          {channels.map((ch) => {
            const active = activeChannel === ch.id;
            const canView = ch.permissions.includes(`view:${ch.id}`);
            return (
              <button
                key={ch.id}
                onClick={() => canView && onSelect(ch.id, "channel")}
                disabled={!canView}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 rounded-sm text-left",
                  "font-mono text-[11px] tracking-wide transition-all duration-150",
                  !canView && "opacity-40 cursor-not-allowed",
                  active
                    ? "bg-zk-green/10 text-zk-green border-l-2 border-zk-green"
                    : "text-zk-slate border-l-2 border-transparent hover:text-zk-white hover:bg-zk-green/5"
                )}
              >
                <span className="truncate">{ch.label}</span>
                {ch.unread > 0 && !active && (
                  <span className="ml-1 shrink-0 font-mono text-[9px] text-zk-bg bg-zk-green rounded-sm px-1 leading-4">
                    {ch.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Direct Messages ──────────────────────────── */}
        <div className="flex items-center justify-between px-3 pt-4 pb-1">
          <span className="font-mono text-[9px] text-zk-muted/50 tracking-[0.2em] uppercase">
            Direct Messages
          </span>
          <button
            onClick={() => setSearching((v) => !v)}
            className="text-zk-muted/40 hover:text-zk-green transition-colors"
            aria-label="New DM"
          >
            <Plus size={11} />
          </button>
        </div>

        {/* Search box */}
        {searching && (
          <div className="px-2 pb-2">
            <div className="relative">
              <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zk-muted/50" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, username, email..."
                className={cn(
                  "w-full pl-7 pr-7 py-1.5 rounded-sm border",
                  "bg-zk-surface/80 border-zk-border/60",
                  "font-mono text-[10px] text-zk-white placeholder:text-zk-muted/30",
                  "outline-none focus:border-zk-green/40 transition-colors"
                )}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setResults([]); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zk-muted/40 hover:text-zk-white"
                >
                  <X size={10} />
                </button>
              )}
            </div>

            {/* Search results */}
            {loadingSearch && (
              <p className="font-mono text-[9px] text-zk-muted/40 px-1 py-1 animate-pulse">Searching...</p>
            )}
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => openDM(u)}
                className="w-full flex items-start gap-2 px-2 py-1.5 rounded-sm hover:bg-zk-green/8 transition-colors text-left"
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0 mt-1",
                  STATUS_COLOR[u.status] ?? STATUS_COLOR.OFFLINE
                )} />
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-zk-white truncate">{u.name}</p>
                  <p className="font-mono text-[9px] text-zk-muted/50 truncate">@{u.username}</p>
                </div>
              </button>
            ))}
            {query.length > 0 && !loadingSearch && results.length === 0 && (
              <p className="font-mono text-[9px] text-zk-muted/30 px-1 py-1">No users found</p>
            )}
          </div>
        )}

        {/* DM conversations */}
        <div className="flex flex-col gap-0.5 px-1">
          {dmConvos.length === 0 && !searching && (
            <p className="font-mono text-[9px] text-zk-muted/30 px-3 py-1">No conversations yet</p>
          )}
          {dmConvos.map((dm) => {
            const active = activeDmUser === dm.userId;
            return (
              <button
                key={dm.userId}
                onClick={() => onSelect(`dm:${dm.userId}`, "dm", dm.userId)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 rounded-sm text-left",
                  "font-mono text-[11px] tracking-wide transition-all duration-150",
                  active
                    ? "bg-zk-green/10 text-zk-green border-l-2 border-zk-green"
                    : "text-zk-slate border-l-2 border-transparent hover:text-zk-white hover:bg-zk-green/5"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-zk-muted/30" aria-hidden="true" />
                <span className="truncate flex-1">{dm.handle}</span>
                {dm.unread > 0 && !active && (
                  <span className="shrink-0 font-mono text-[9px] text-zk-bg bg-zk-green rounded-sm px-1 leading-4">
                    {dm.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-3 border-t border-zk-border/50">
        <span className="font-mono text-[9px] text-zk-muted/30 tracking-widest">
          E2E ENCRYPTED · AES-256
        </span>
      </div>
    </aside>
  );
}
