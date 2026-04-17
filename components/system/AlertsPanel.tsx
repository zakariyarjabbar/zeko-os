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
    label:  "Critical",
    color:  "text-zk-red",
    bg:     "bg-zk-red/5",
    border: "border-zk-red/20",
    icon:   <ShieldAlert size={12} />,
  },
  warn: {
    label:  "Warning",
    color:  "text-zk-amber",
    bg:     "bg-zk-amber/5",
    border: "border-zk-amber/20",
    icon:   <AlertTriangle size={12} />,
  },
  info: {
    label:  "Info",
    color:  "text-zk-green",
    bg:     "bg-zk-green/5",
    border: "border-zk-green/15",
    icon:   <Info size={12} />,
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
            "absolute top-full right-0 mt-2 w-[380px] z-[200]",
            "rounded border border-zk-border",
            "bg-[rgba(13,17,23,0.97)] backdrop-blur-[16px]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_0_1px_rgba(0,255,65,0.06)]",
            "flex flex-col overflow-hidden",
          )}
          // Prevent clicks inside bubbling to the outside-click listener
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ───────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zk-border">
            <div className="flex items-center gap-2.5">
              <span className="font-sans text-sm font-semibold text-zk-white">
                DM Alerts
              </span>
              {alerts.length > 0 && (
                <span className="font-sans text-xs text-zk-bg bg-zk-green rounded px-1.5 py-0.5 leading-none">
                  {alerts.length}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close alerts"
              className="text-zk-muted hover:text-zk-white transition-colors duration-150 p-1 rounded hover:bg-zk-surface"
            >
              <X size={14} />
            </button>
          </div>

          {/* ── Alert list ───────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto max-h-[320px]">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span className="font-sans text-xs text-zk-muted/40 uppercase tracking-wide">
                  No active alerts
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
                        "flex items-start gap-3 px-4 py-3.5",
                        "transition-colors duration-100 hover:bg-white/[0.02]"
                      )}
                    >
                      {/* Severity icon */}
                      <span className={cn("shrink-0 mt-0.5", sev.color)}>
                        {sev.icon}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          {/* Severity tag */}
                          <span
                            className={cn(
                              "font-sans text-xs font-medium px-1.5 py-0.5 rounded border",
                              sev.color, sev.bg, sev.border
                            )}
                          >
                            {sev.label}
                          </span>
                          {/* Timestamp */}
                          <span className="font-mono text-xs text-zk-muted/50">
                            {alert.timestamp}
                          </span>
                        </div>
                        {/* Message */}
                        <p className="font-sans text-sm text-zk-slate/90 leading-relaxed">
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
          <div className="px-4 py-3 border-t border-zk-border flex items-center justify-between">
            <span className="font-sans text-xs text-zk-muted/40 uppercase tracking-wide">
              {alerts.filter(a => a.severity === "critical").length} critical
              &nbsp;·&nbsp;
              {alerts.filter(a => a.severity === "warn").length} warn
              &nbsp;·&nbsp;
              {alerts.filter(a => a.severity === "info").length} info
            </span>
            <button
              onClick={onClear}
              className={cn(
                "flex items-center gap-1.5 font-sans text-xs px-3 py-1.5 rounded",
                "text-zk-muted hover:text-zk-red hover:bg-zk-red/5 transition-colors duration-150",
                alerts.length === 0 && "opacity-30 pointer-events-none"
              )}
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
