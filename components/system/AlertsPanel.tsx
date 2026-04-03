// components/system/AlertsPanel.tsx
// Glassmorphism alerts dropdown — slides in below the bell icon.
// Framer Motion: fade + slide down on enter, reverse on exit.

"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, AlertTriangle, Info, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SystemAlert, type AlertSeverity } from "./SystemHeader";

// ─── Severity config ──────────────────────────────────────────
const SEVERITY: Record<
  AlertSeverity,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  critical: {
    label:  "CRITICAL",
    color:  "text-zk-red",
    bg:     "bg-zk-red/5",
    border: "border-zk-red/20",
    icon:   <ShieldAlert size={11} />,
  },
  warn: {
    label:  "WARN",
    color:  "text-zk-amber",
    bg:     "bg-zk-amber/5",
    border: "border-zk-amber/20",
    icon:   <AlertTriangle size={11} />,
  },
  info: {
    label:  "INFO",
    color:  "text-zk-green",
    bg:     "bg-zk-green/5",
    border: "border-zk-green/15",
    icon:   <Info size={11} />,
  },
};

// ─── Props ────────────────────────────────────────────────────
interface AlertsPanelProps {
  open: boolean;
  alerts: SystemAlert[];
  onClose: () => void;
  onClear: () => void;
}

// ─── Component ────────────────────────────────────────────────
export function AlertsPanel({ open, alerts, onClose, onClear }: AlertsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          key="alerts-panel"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn(
            "absolute top-full right-0 mt-2 w-[360px] z-[200]",
            "rounded-sm border border-zk-border",
            "bg-[rgba(13,17,23,0.97)] backdrop-blur-[16px]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_0_1px_rgba(0,255,65,0.06)]",
            "flex flex-col overflow-hidden",
          )}
          // Prevent clicks inside bubbling to the outside-click listener
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ───────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zk-border">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-zk-green tracking-[0.15em] uppercase">
                SYSTEM_ALERTS
              </span>
              {alerts.length > 0 && (
                <span className="font-mono text-[9px] text-zk-bg bg-zk-green rounded-sm px-1.5 py-0.5 leading-none">
                  {alerts.length}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close alerts"
              className="text-zk-muted hover:text-zk-white transition-colors duration-150"
            >
              <X size={13} />
            </button>
          </div>

          {/* ── Alert list ───────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto max-h-[320px]">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="font-mono text-[10px] text-zk-muted/40 tracking-widest">
                  NO ACTIVE ALERTS
                </span>
              </div>
            ) : (
              <div className="divide-y divide-zk-border/50">
                {alerts.map((alert) => {
                  const sev = SEVERITY[alert.severity];
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3",
                        "transition-colors duration-100 hover:bg-white/[0.02]"
                      )}
                    >
                      {/* Severity icon */}
                      <span className={cn("shrink-0 mt-0.5", sev.color)}>
                        {sev.icon}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          {/* Severity tag */}
                          <span
                            className={cn(
                              "font-mono text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded-sm border",
                              sev.color, sev.bg, sev.border
                            )}
                          >
                            {sev.label}
                          </span>
                          {/* Timestamp */}
                          <span className="font-mono text-[9px] text-zk-muted/50 tracking-wider">
                            {alert.timestamp}
                          </span>
                        </div>
                        {/* Message */}
                        <p className="font-mono text-[11px] text-zk-slate/90 leading-relaxed">
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────── */}
          <div className="px-4 py-2.5 border-t border-zk-border flex items-center justify-between">
            <span className="font-mono text-[9px] text-zk-muted/40 tracking-widest">
              {alerts.filter(a => a.severity === "critical").length} CRITICAL
              &nbsp;·&nbsp;
              {alerts.filter(a => a.severity === "warn").length} WARN
              &nbsp;·&nbsp;
              {alerts.filter(a => a.severity === "info").length} INFO
            </span>
            <button
              onClick={onClear}
              className={cn(
                "flex items-center gap-1.5 font-mono text-[10px] tracking-wider",
                "text-zk-muted hover:text-zk-red transition-colors duration-150",
                alerts.length === 0 && "opacity-30 pointer-events-none"
              )}
            >
              <Trash2 size={11} />
              Clear Logs
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
