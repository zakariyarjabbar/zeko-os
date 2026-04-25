// components/system/chat/NotificationsPanel.tsx
// Dropdown panel for @mention notifications, anchored to a bell icon.
// Marks all as read when opened.

"use client";

import { useEffect, useRef }         from "react";
import { Bell }                      from "lucide-react";
import { cn }                        from "@/lib/utils";
import { type AppNotification }      from "./types";

interface NotificationsPanelProps {
  notifications: AppNotification[];
  unread:        number;
  open:          boolean;
  onToggle:      () => void;
  onNavigate:    (n: AppNotification) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsPanel({
  notifications, unread, open, onToggle, onNavigate,
}: NotificationsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  return (
    <div ref={panelRef} className="relative shrink-0">
      {/* Bell button */}
      <button
        onClick={onToggle}
        aria-label="Notifications"
        className={cn(
          "relative p-1.5 rounded border transition-all duration-150",
          open
            ? "border-zk-green/40 text-zk-green bg-zk-green/10"
            : "border-transparent text-zk-muted/40 hover:text-zk-white hover:border-zk-border/60",
        )}
      >
        <Bell size={13} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-zk-amber text-[8px] font-bold text-black flex items-center justify-center leading-none select-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          "absolute right-0 top-full mt-2 z-50",
          "w-80 max-h-96 overflow-y-auto",
          "bg-zk-surface border border-zk-border/60 rounded-sm shadow-xl",
        )}>
          <div className="px-3 py-2 border-b border-zk-border/40 flex items-center justify-between">
            <span className="font-sans text-xs font-semibold text-zk-muted/60 uppercase tracking-wider">
              Mentions
            </span>
            {unread > 0 && (
              <span className="font-sans text-xs text-zk-amber/70">
                {unread} unread
              </span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <span className="font-sans text-xs text-zk-muted/30">No mentions yet</span>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate(n)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-zk-border/20 last:border-0",
                  "hover:bg-zk-green/5 transition-colors duration-100",
                  !n.read && "bg-zk-amber/[0.04]",
                )}
              >
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="font-sans text-xs font-semibold text-zk-white/80">
                    @{n.from_handle}
                  </span>
                  <span className="font-sans text-[10px] text-zk-muted/30 shrink-0">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-zk-white/60 leading-relaxed line-clamp-2">
                  {n.body}
                </p>
                {n.channel_id && (
                  <span className="font-sans text-[10px] text-zk-muted/30 mt-0.5 block">
                    #{n.channel_id}
                  </span>
                )}
                {!n.read && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-zk-amber mt-1" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
