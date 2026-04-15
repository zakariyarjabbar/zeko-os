// components/ui/KonamiCode.tsx
// Global easter egg: type ↑↑↓↓←→←→BA anywhere on the page to unlock
// a terminal-style "cheat code activated" modal.

"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const SEQUENCE = [
  "ArrowUp", "ArrowUp",
  "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight",
  "ArrowLeft", "ArrowRight",
  "b", "a",
];

const LINES = [
  { text: "> Konami sequence detected...",      delay: 0   },
  { text: "> Verifying operator clearance...",  delay: 280 },
  { text: "> Clearance level: ULTRA",           delay: 560 },
  { text: "> Enabling god mode...",             delay: 840 },
  { text: "> All restrictions lifted.",         delay: 1120 },
  { text: "> System override: COMPLETE",        delay: 1400 },
  { text: "",                                    delay: 1600 },
  { text: "  Welcome to the matrix, operator.", delay: 1700 },
];

export function KonamiCode() {
  const [progress, setProgress] = useState(0);
  const [open,     setOpen]     = useState(false);
  const [visible,  setVisible]  = useState(0); // how many lines revealed

  const close = useCallback(() => {
    setOpen(false);
    setProgress(0);
    setVisible(0);
  }, []);

  // Key listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't steal from inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      if (e.key === SEQUENCE[progress]) {
        const next = progress + 1;
        if (next === SEQUENCE.length) {
          setOpen(true);
          setProgress(0);
        } else {
          setProgress(next);
        }
      } else {
        // Wrong key — reset, but check if it starts the sequence fresh
        setProgress(e.key === SEQUENCE[0] ? 1 : 0);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [progress]);

  // Stagger line reveals when modal opens
  useEffect(() => {
    if (!open) return;
    setVisible(0);
    LINES.forEach((line, i) => {
      setTimeout(() => setVisible(i + 1), line.delay + 100);
    });
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, close]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-6"
      style={{ animation: "zk-fade-up 0.25s ease-out both" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg terminal-block",
          "shadow-[0_0_80px_rgba(0,255,65,0.25),0_0_160px_rgba(0,255,65,0.08)]"
        )}
        style={{ animation: "zk-icon-pop 0.4s cubic-bezier(0.34,1.4,0.64,1) both" }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zk-green/20 bg-black/50">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-zk-green" />
            <span className="font-mono text-xs text-zk-green/80 tracking-wider">
              zeko@os — /secret/cheat-code.sh
            </span>
          </div>
          <button
            onClick={close}
            className="text-zk-muted hover:text-zk-white transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-1 min-h-[220px]">
          {/* ASCII badge */}
          <div
            className="mb-4 font-mono text-[10px] text-zk-green/50 leading-4"
            style={{ animation: "zk-log-appear 0.3s ease-out 0.05s both" }}
          >
            {"██████╗ ██╗  ██╗███████╗ █████╗ ████████╗  ██████╗  ██████╗ ██████╗  ███████╗"}
          </div>

          {LINES.map((line, i) => (
            i < visible ? (
              <div
                key={i}
                className={cn(
                  "font-mono text-sm leading-6",
                  line.text.startsWith(">")
                    ? "text-zk-muted"
                    : "text-zk-green font-bold tracking-wide"
                )}
                style={{ animation: "zk-log-appear 0.25s ease-out both" }}
              >
                {line.text || <span className="block h-2" />}
              </div>
            ) : null
          ))}

          {/* Blinking cursor after all lines shown */}
          {visible >= LINES.length && (
            <span className="terminal-cursor mt-1" aria-hidden="true" />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zk-border/40 flex items-center justify-between bg-black/20">
          <span className="font-mono text-[10px] text-zk-muted/50 tracking-widest">
            ESC or click outside to close
          </span>
          <button
            onClick={close}
            className={cn(
              "font-mono text-xs text-zk-green border border-zk-green/30 rounded-sm px-3 py-1",
              "hover:bg-zk-green/10 hover:border-zk-green/60 transition-all duration-150"
            )}
          >
            ACKNOWLEDGED
          </button>
        </div>
      </div>
    </div>
  );
}
