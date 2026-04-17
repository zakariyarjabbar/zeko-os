// components/system/chat/UserProfileCard.tsx
// Small floating card shown when clicking a user's avatar or name in chat.
// Displays current display name, @username, online status, and a DM button.

"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, X }  from "lucide-react";
import { cn }                from "@/lib/utils";

// ─── Same avatar colour system as MessageLog ─────────────────
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

// ─── Props ────────────────────────────────────────────────────
interface UserProfileCardProps {
  userId:      string;
  displayName: string;
  username:    string;
  isOnline:    boolean;
  isSelf:      boolean;
  anchorX:     number;   // raw clientX from the click event
  anchorY:     number;   // raw clientY from the click event
  onClose:     () => void;
  onOpenDm?:   (userId: string, username: string) => void;
}

const CARD_W = 220;
const CARD_H = 170;

export function UserProfileCard({
  userId, displayName, username, isOnline, isSelf,
  anchorX, anchorY, onClose, onOpenDm,
}: UserProfileCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  // ── Close on outside click or Escape ─────────────────────
  useEffect(() => {
    function handleMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Slight delay so the very click that opened the card doesn't immediately close it
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handleMouse);
      document.addEventListener("keydown",   handleKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleMouse);
      document.removeEventListener("keydown",   handleKey);
    };
  }, [onClose]);

  // ── Smart position — stay inside viewport ─────────────────
  const vw  = typeof window !== "undefined" ? window.innerWidth  : 1280;
  const vh  = typeof window !== "undefined" ? window.innerHeight : 800;
  const GAP = 10;

  const left = anchorX + GAP + CARD_W > vw ? anchorX - CARD_W - GAP : anchorX + GAP;
  const top  = anchorY + CARD_H       > vh ? anchorY - CARD_H        : anchorY;

  // ── Derived values ────────────────────────────────────────
  const name  = displayName || username || "?";
  const init  = name[0].toUpperCase();
  const color = avatarColor(username || name);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed z-[450] w-[220px]",
        "bg-[rgba(10,15,10,0.98)] border border-zk-border rounded",
        "shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
        "overflow-hidden",
        "animate-fade-in-up",
      )}
      style={{ left, top }}
    >
      {/* Top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-zk-green/35 to-transparent" />

      {/* Header: avatar + close */}
      <div className="flex items-start justify-between px-3 pt-3 pb-0 gap-2">
        <div className={cn(
          "w-10 h-10 rounded shrink-0 flex items-center justify-center",
          "border text-sm font-mono font-bold select-none",
          color,
        )}>
          {init}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-zk-muted/30 hover:text-zk-muted/70 transition-colors mt-0.5 shrink-0"
        >
          <X size={11} />
        </button>
      </div>

      {/* Identity */}
      <div className="px-3 pt-2 pb-3 space-y-0.5">
        <p className="font-sans text-sm font-semibold text-zk-white leading-tight">
          {name}
        </p>
        <p className="font-sans text-sm text-zk-muted/60">
          @{username}
        </p>

        {/* Status */}
        <div className="flex items-center gap-1.5 pt-1.5">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            isOnline ? "bg-zk-green shadow-glow-sm" : "bg-zk-muted/30",
          )} />
          <span className="font-sans text-xs text-zk-muted/50">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* DM button — only for other users */}
      {!isSelf && onOpenDm && (
        <>
          <div className="h-px w-full bg-zk-border/40 mx-0" />
          <div className="px-3 py-2.5">
            <button
              onClick={() => { onOpenDm(userId, username); onClose(); }}
              className={cn(
                "w-full h-7 flex items-center justify-center gap-1.5",
                "font-sans text-sm rounded border",
                "border-zk-green/25 bg-zk-green/8 text-zk-green/70",
                "hover:bg-zk-green/15 hover:border-zk-green/50 hover:text-zk-green",
                "transition-all duration-150",
              )}
            >
              <MessageSquare size={10} />
              Send Direct Message
            </button>
          </div>
        </>
      )}
    </div>
  );
}
