// components/ui/AuthShell.tsx
// Shared chrome for /login and /signup — card + header + stats strip
// + split body (form | live telemetry) + footer. Accent-themed.

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NetworkBackground, type NetworkBgHandle } from "./NetworkBackground";

// ─── Accent ────────────────────────────────────────────────────
export type AuthAccentName = "green" | "cyan";

export interface AuthAccent {
  hex: string;
  rgb: string; // "r, g, b"
}

export const ACCENTS: Record<AuthAccentName, AuthAccent> = {
  green: { hex: "#00FF41", rgb: "0, 255, 65" },
  cyan:  { hex: "#00D4FF", rgb: "0, 212, 255" },
};

// ─── Telemetry line shape ─────────────────────────────────────
export type TelemetryTag =
  | "BOOT" | "LINK" | "FIELD" | "INPUT" | "CHECK"
  | "WARN" | "SEND" | "OK"    | "ERR";

export interface TelemetryLine {
  id: number;
  ts: number; // seconds since page mount
  tag: TelemetryTag;
  msg: string;
}

const TAG_COLORS: Record<TelemetryTag, string> = {
  BOOT:  "rgba(240,246,240,0.55)",
  LINK:  "rgba(139,158,139,0.85)",
  FIELD: "rgba(139,158,139,0.75)",
  INPUT: "rgba(107,122,107,0.65)",
  CHECK: "rgba(0,212,255,0.75)",
  WARN:  "#FFB800",
  SEND:  "rgba(0,255,65,0.80)",
  OK:    "#00FF41",
  ERR:   "#FF3B3B",
};

// ─── Shell ─────────────────────────────────────────────────────
interface AuthShellProps {
  accent: AuthAccentName;
  backHref: string;
  backLabel: string;

  moduleLabel: string;       // e.g. "Authentication Module"
  title: string;             // e.g. "Establish Connection"
  subtitle: string;          // one-line instruction
  statusLabel: string;       // e.g. "LIVE" | "OPEN"
  statusSubLabel?: string;   // small text under status

  logo: ReactNode;
  stats: { key: string; value: string }[];
  uptime: string;

  telemetryTitle: string;
  telemetry: TelemetryLine[];

  bgRef: React.MutableRefObject<NetworkBgHandle | null>;

  shortcutHint?: string;
  children: ReactNode;
}

export function AuthShell({
  accent, backHref, backLabel,
  moduleLabel, title, subtitle, statusLabel, statusSubLabel,
  logo, stats, uptime,
  telemetryTitle, telemetry,
  bgRef, shortcutHint, children,
}: AuthShellProps) {
  const a = ACCENTS[accent];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden bg-zk-bg">
      <NetworkBackground bgRef={bgRef} />

      {/* Back */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-zk-muted hover:text-zk-green transition-colors duration-150 group"
        >
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
          {backLabel}
        </Link>
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative z-10 w-full max-w-4xl"
      >
        <div
          className="relative overflow-hidden"
          style={{
            background: "rgba(3, 5, 4, 0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `1px solid rgba(${a.rgb}, 0.16)`,
            boxShadow: `0 0 80px rgba(${a.rgb}, 0.04), 0 24px 80px rgba(0,0,0,0.88), inset 0 1px 0 rgba(${a.rgb}, 0.07)`,
          }}
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-5 h-5 pointer-events-none"
            style={{ borderTop: `1px solid rgba(${a.rgb}, 0.5)`, borderLeft:  `1px solid rgba(${a.rgb}, 0.5)` }} />
          <div className="absolute top-0 right-0 w-5 h-5 pointer-events-none"
            style={{ borderTop: `1px solid rgba(${a.rgb}, 0.5)`, borderRight: `1px solid rgba(${a.rgb}, 0.5)` }} />
          <div className="absolute bottom-0 left-0 w-5 h-5 pointer-events-none"
            style={{ borderBottom: `1px solid rgba(${a.rgb}, 0.5)`, borderLeft:  `1px solid rgba(${a.rgb}, 0.5)` }} />
          <div className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none"
            style={{ borderBottom: `1px solid rgba(${a.rgb}, 0.5)`, borderRight: `1px solid rgba(${a.rgb}, 0.5)` }} />

          {/* Scan line */}
          <motion.div
            className="absolute left-0 right-0 h-px pointer-events-none z-10"
            style={{
              background: `linear-gradient(90deg, transparent 0%, rgba(${a.rgb}, 0.35) 20%, rgba(${a.rgb}, 0.7) 50%, rgba(${a.rgb}, 0.35) 80%, transparent 100%)`,
              boxShadow: `0 0 8px rgba(${a.rgb}, 0.4)`,
            }}
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, ease: "linear" }}
          />

          {/* ── Header ─────────────────────────────────────────── */}
          <div
            className="flex items-center gap-4 px-6 pt-6 pb-4"
            style={{ borderBottom: `1px solid rgba(${a.rgb}, 0.07)` }}
          >
            {logo}
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-sm font-bold tracking-[0.12em] text-zk-white">
                ZEKO<span style={{ color: a.hex }}>{"//"}</span>NET
              </span>
              <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-zk-muted">
                {moduleLabel}
              </span>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: a.hex, boxShadow: `0 0 6px ${a.hex}` }}
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="font-mono text-[9px] tracking-[0.2em]" style={{ color: a.hex }}>
                  {statusLabel}
                </span>
              </div>
              {statusSubLabel && (
                <span className="font-mono text-[8px] text-zk-muted/50 tracking-wider">
                  {statusSubLabel}
                </span>
              )}
            </div>
          </div>

          {/* ── Stats strip ────────────────────────────────────── */}
          <div
            className="flex items-center gap-5 px-6 py-2 flex-wrap"
            style={{
              background: `rgba(${a.rgb}, 0.02)`,
              borderBottom: `1px solid rgba(${a.rgb}, 0.07)`,
            }}
          >
            {stats.map(({ key, value }) => (
              <span key={key} className="font-mono text-[9px] tracking-widest text-zk-muted">
                {key}:{" "}
                <motion.span
                  key={value}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{ color: `rgba(${a.rgb}, 0.65)` }}
                >
                  {value}
                </motion.span>
              </span>
            ))}
            <span className="ml-auto font-mono text-[9px] tracking-widest text-zk-muted/45">
              ■ UPTIME {uptime}
            </span>
          </div>

          {/* ── Body: form | divider | telemetry ────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_minmax(0,300px)]">
            {/* Form column */}
            <div className="px-6 pt-7 pb-7 min-w-0">
              <h1
                className="font-mono font-bold tracking-[0.18em] uppercase mb-1"
                style={{
                  fontSize: "1.05rem",
                  color: "#F0F6F0",
                  textShadow: `0 0 20px rgba(${a.rgb}, 0.15)`,
                }}
              >
                {title}
              </h1>
              <p className="font-mono text-[11px] text-zk-muted tracking-wide mb-6">
                {subtitle}
              </p>
              {children}
            </div>

            {/* Vertical divider (md+) */}
            <div
              className="hidden md:block"
              style={{ background: `rgba(${a.rgb}, 0.08)` }}
            />

            {/* Telemetry column */}
            <div
              className="px-5 py-5 border-t md:border-t-0"
              style={{
                background: `rgba(${a.rgb}, 0.015)`,
                borderTopColor: `rgba(${a.rgb}, 0.08)`,
              }}
            >
              <TelemetryPanel accent={a} title={telemetryTitle} lines={telemetry} />
            </div>
          </div>

          {/* Footer bar */}
          {shortcutHint && (
            <div
              className="px-6 py-2 flex items-center justify-between font-mono text-[9px] tracking-[0.2em] uppercase"
              style={{
                borderTop: `1px solid rgba(${a.rgb}, 0.07)`,
                background: `rgba(${a.rgb}, 0.02)`,
              }}
            >
              <span className="text-zk-muted/55">READY</span>
              <span style={{ color: `rgba(${a.rgb}, 0.55)` }}>{shortcutHint}</span>
            </div>
          )}
        </div>

        {/* Protocol line */}
        <p className="mt-3 font-mono text-[9px] text-zk-muted/35 text-center tracking-[0.25em]">
          PROTOCOL: TLS 1.3 &nbsp;·&nbsp; CIPHER: AES-256-GCM &nbsp;·&nbsp; AUTH: HMAC-SHA256
        </p>
      </motion.div>
    </main>
  );
}

// ─── Telemetry panel ──────────────────────────────────────────
function TelemetryPanel({
  accent, title, lines,
}: {
  accent: AuthAccent;
  title: string;
  lines: TelemetryLine[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="flex flex-col h-full min-h-[360px]">
      <div
        className="flex items-center justify-between mb-3 pb-2"
        style={{ borderBottom: `1px solid rgba(${accent.rgb}, 0.08)` }}
      >
        <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-zk-muted/80">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          <motion.span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: accent.hex, boxShadow: `0 0 6px ${accent.hex}` }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span
            className="font-mono text-[9px] tracking-wider"
            style={{ color: `rgba(${accent.rgb}, 0.55)` }}
          >
            STREAM
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[10px] leading-[1.5] pr-1"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: `rgba(${accent.rgb}, 0.3) transparent`,
          maxHeight: 360,
        }}
      >
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-start gap-1.5"
            >
              <span className="text-zk-muted/40 tabular-nums shrink-0">
                [{line.ts.toFixed(2).padStart(6, " ")}]
              </span>
              <span
                className="font-bold tracking-wider w-[38px] shrink-0"
                style={{ color: TAG_COLORS[line.tag] }}
              >
                {line.tag}
              </span>
              <span className="text-zk-white/70 break-all">{line.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Live prompt */}
        <div className="flex items-center gap-1.5 pt-1.5">
          <span style={{ color: `rgba(${accent.rgb}, 0.7)` }}>&gt;</span>
          <motion.span
            className="inline-block w-1.5 h-[10px]"
            style={{ background: accent.hex }}
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          />
        </div>
      </div>
    </div>
  );
}
