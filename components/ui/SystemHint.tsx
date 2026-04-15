// components/ui/SystemHint.tsx
// Bottom-right toast that hints at the Konami code easter egg.
// Schedule: first at 35 s → again at +1 m → then every 5 m indefinitely.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Timing ──────────────────────────────────────────────────
const DELAYS = {
  first:  35_000,  // 35 seconds on first load
  second: 60_000,  // 1 minute after first dismissal
  repeat: 300_000, // 5 minutes for every subsequent appearance
} as const;

const AUTO_DISMISS  = 12_000; // toast stays visible for 12 s then leaves
const LEAVE_ANIM_MS = 450;    // must match slide-out animation duration

function nextDelay(showCount: number): number {
  if (showCount === 0) return DELAYS.first;
  if (showCount === 1) return DELAYS.second;
  return DELAYS.repeat;
}

// ─── Key chips data ───────────────────────────────────────────
const HINT_KEYS = [
  { label: "↑", title: "ArrowUp"    },
  { label: "↑", title: "ArrowUp"    },
  { label: "↓", title: "ArrowDown"  },
  { label: "↓", title: "ArrowDown"  },
  { label: "←", title: "ArrowLeft"  },
  { label: "→", title: "ArrowRight" },
  { label: "←", title: "ArrowLeft"  },
  { label: "→", title: "ArrowRight" },
  { label: "B", title: "B"          },
  { label: "A", title: "A"          },
];

// ─── Component ───────────────────────────────────────────────
export function SystemHint() {
  const [phase, setPhase] = useState<"hidden" | "visible" | "leaving">("hidden");

  // How many times the toast has been shown (never reset while page is open)
  const showCount    = useRef(0);
  const nextTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule the next appearance
  const scheduleNext = useCallback(() => {
    if (nextTimer.current) clearTimeout(nextTimer.current);
    nextTimer.current = setTimeout(() => {
      showCount.current += 1;
      setPhase("visible");
    }, nextDelay(showCount.current));
  }, []);

  // Slide out, then hide and re-schedule
  const dismiss = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setPhase("leaving");
    leaveTimer.current = setTimeout(() => {
      setPhase("hidden");
      scheduleNext();
    }, LEAVE_ANIM_MS);
  }, [scheduleNext]);

  // Boot: kick off the very first schedule
  useEffect(() => {
    scheduleNext();
    return () => {
      if (nextTimer.current)  clearTimeout(nextTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, [scheduleNext]);

  // Auto-dismiss after AUTO_DISMISS ms whenever toast becomes visible
  useEffect(() => {
    if (phase !== "visible") return;
    const t = setTimeout(dismiss, AUTO_DISMISS);
    return () => clearTimeout(t);
  }, [phase, dismiss]);

  if (phase === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 right-6 z-[9980] w-[300px]",
        "terminal-block",
        "shadow-[0_0_40px_rgba(0,255,65,0.12),0_8px_32px_rgba(0,0,0,0.6)]"
      )}
      style={{
        animation:
          phase === "leaving"
            ? `zk-slide-out-right ${LEAVE_ANIM_MS}ms cubic-bezier(0.4,0,1,1) forwards`
            : "zk-slide-in-right 0.45s cubic-bezier(0.22,1,0.36,1) forwards",
      }}
    >
      {/* ── Title bar ─────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zk-green/15 bg-black/50">
        <div className="flex items-center gap-2">
          <Terminal size={11} className="text-zk-green" />
          <span className="font-mono text-[10px] text-zk-green/70 tracking-widest uppercase">
            sys_hint
          </span>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss hint"
          className="text-zk-muted hover:text-zk-white transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* ── Body ──────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3">
        {/* Boot-log lines */}
        <div className="space-y-1">
          {[
            { text: "Undocumented kernel command", delay: "0ms"  },
            { text: "detected in operator memory.", delay: "80ms" },
          ].map(({ text, delay }) => (
            <p
              key={text}
              className="font-mono text-[11px] text-zk-muted leading-5 opacity-0"
              style={{ animation: `zk-log-appear 0.3s ease-out ${delay} forwards` }}
            >
              <span className="text-zk-green/60 mr-1.5">{">"}</span>
              {text}
            </p>
          ))}
        </div>

        {/* Divider */}
        <div
          className="border-t border-zk-border/40 opacity-0"
          style={{ animation: "zk-log-appear 0.3s ease-out 180ms forwards" }}
        />

        {/* Label */}
        <p
          className="font-mono text-[10px] text-zk-muted/50 tracking-widest uppercase opacity-0"
          style={{ animation: "zk-log-appear 0.3s ease-out 260ms forwards" }}
        >
          try this sequence:
        </p>

        {/* Key chips */}
        <div
          className="flex flex-wrap gap-1 opacity-0"
          style={{ animation: "zk-log-appear 0.35s ease-out 340ms forwards" }}
        >
          {HINT_KEYS.map((k, i) => (
            <kbd
              key={i}
              title={k.title}
              className={cn(
                "inline-flex items-center justify-center",
                "w-6 h-6 rounded-sm border font-mono text-[11px] font-bold",
                "border-zk-green/30 bg-zk-green/8 text-zk-green",
                "shadow-[0_0_6px_rgba(0,255,65,0.15)]",
                "select-none"
              )}
            >
              {k.label}
            </kbd>
          ))}
        </div>

        {/* Footnote */}
        <p
          className="font-mono text-[9px] text-zk-muted/35 tracking-widest opacity-0"
          style={{ animation: "zk-log-appear 0.3s ease-out 480ms forwards" }}
        >
          {"// classified · operator use only"}
        </p>
      </div>

      {/* ── Auto-dismiss timer bar ─────────────────── */}
      <div className="h-px bg-zk-border/30 overflow-hidden">
        <div
          className="h-full bg-zk-green/50"
          style={{
            animation: `zk-timer-drain ${AUTO_DISMISS}ms linear forwards`,
            boxShadow: "0 0 4px rgba(0,255,65,0.4)",
          }}
        />
      </div>
    </div>
  );
}
