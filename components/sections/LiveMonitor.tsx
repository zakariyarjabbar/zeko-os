// components/sections/LiveMonitor.tsx
// "SYSTEM_VITALS" — live OS-style system monitor.
// Metric bars update every 600 ms with random-walk values.
// Each card has a tiny SVG sparkline of the last 28 readings.
// A process table refreshes CPU values every 800 ms.

"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Activity, Cpu, HardDrive, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────
interface MetricCfg {
  key:   string;
  label: string;
  unit:  string;
  icon:  React.ElementType;
  init:  number;
  lo:    number; // absolute min
  hi:    number; // absolute max
  drift: number; // max step per tick
}

interface MetricState {
  current: number;
  history: number[]; // last 28 values
}

interface Process {
  pid:    number;
  name:   string;
  cpu:    number;
  mem:    number;
  status: "S" | "R";
}

// ─── Static config ───────────────────────────────────────────
const METRICS: MetricCfg[] = [
  { key: "cpu",   label: "CPU USAGE",  unit: "%",    icon: Cpu,       init: 34,  lo: 5,   hi: 96,  drift: 10 },
  { key: "mem",   label: "MEMORY",     unit: "%",    icon: HardDrive, init: 67,  lo: 55,  hi: 88,  drift: 3  },
  { key: "netin", label: "NET IN",     unit: "MB/s", icon: Wifi,      init: 2.4, lo: 0.1, hi: 14,  drift: 1.8 },
  { key: "act",   label: "ACTIVE OPS", unit: "/s",   icon: Activity,  init: 142, lo: 80,  hi: 260, drift: 20 },
];

const INITIAL_PROCS: Process[] = [
  { pid: 1,    name: "zk-kernel",     cpu: 0.1,  mem: 2.1,  status: "S" },
  { pid: 142,  name: "auth-service",  cpu: 0.8,  mem: 4.2,  status: "S" },
  { pid: 891,  name: "api-gateway",   cpu: 1.2,  mem: 8.7,  status: "R" },
  { pid: 1024, name: "chat-ws",       cpu: 2.1,  mem: 12.4, status: "R" },
  { pid: 2048, name: "redis-server",  cpu: 0.3,  mem: 18.2, status: "S" },
  { pid: 3301, name: "postgres",      cpu: 0.9,  mem: 32.1, status: "S" },
  { pid: 4096, name: "nginx",         cpu: 0.1,  mem: 3.4,  status: "S" },
  { pid: 5000, name: "node-worker",   cpu: 3.4,  mem: 56.8, status: "R" },
];

// ─── Helpers ─────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function randomWalk(v: number, drift: number, lo: number, hi: number) {
  return clamp(v + (Math.random() - 0.48) * drift, lo, hi);
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-zk-red";
  if (pct >= 55) return "bg-zk-amber";
  return "bg-zk-green";
}

function glowColor(pct: number): string {
  if (pct >= 80) return "rgba(255,59,59,0.4)";
  if (pct >= 55) return "rgba(255,184,0,0.4)";
  return "rgba(0,255,65,0.4)";
}

function textColor(pct: number): string {
  if (pct >= 80) return "text-zk-red";
  if (pct >= 55) return "text-zk-amber";
  return "text-zk-green";
}

// ─── Sparkline ───────────────────────────────────────────────
function Sparkline({ values, hi }: { values: number[]; hi: number }) {
  if (values.length < 2) return null;
  const W = 88, H = 28;
  const lo  = Math.min(...values);
  const top = Math.max(...values, lo + 0.01);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - lo) / (top - lo)) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  // Color based on last value relative to hi
  const pct  = (values[values.length - 1] / hi) * 100;
  const stroke = pct >= 80 ? "#FF3B3B" : pct >= 55 ? "#FFB800" : "#00FF41";

  return (
    <svg
      width={W}
      height={H}
      className="overflow-visible opacity-70"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Metric Card ─────────────────────────────────────────────
// memo: only re-renders when cfg or state reference actually changes
const MetricCard = memo(function MetricCard({ cfg, state }: { cfg: MetricCfg; state: MetricState }) {
  const [hovered, setHovered] = useState(false);
  const pct      = (state.current / cfg.hi) * 100;
  const Icon     = cfg.icon;
  const formatted =
    cfg.unit === "%" || cfg.unit === "/s"
      ? `${Math.round(state.current)}${cfg.unit}`
      : `${state.current.toFixed(1)} ${cfg.unit}`;

  return (
    <div
      className={cn(
        "relative rounded-sm border p-4 transition-all duration-300 cursor-default",
        "bg-[rgba(0,0,0,0.45)] overflow-hidden",
        hovered
          ? "border-zk-green/35 bg-[rgba(0,255,65,0.04)]"
          : "border-zk-border"
      )}
      style={
        hovered
          ? { boxShadow: `0 0 20px ${glowColor(pct)}` }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={13} className={cn("shrink-0", textColor(pct))} />
          <span className="font-mono text-[10px] text-zk-muted tracking-widest">
            {cfg.label}
          </span>
        </div>
        <span className={cn("font-mono text-base font-bold tabular-nums", textColor(pct))}>
          {formatted}
        </span>
      </div>

      {/* Bar track */}
      <div className="relative h-1 bg-zk-border rounded-full overflow-hidden mb-3">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor(pct))}
          style={{
            width: `${clamp(pct, 0, 100)}%`,
            boxShadow: `0 0 6px ${glowColor(pct)}`,
          }}
        />
      </div>

      {/* Sparkline */}
      <div className="flex items-end justify-between">
        <Sparkline values={state.history} hi={cfg.hi} />
        <span className="font-mono text-[9px] text-zk-muted/50 self-end tabular-nums">
          max {cfg.hi}{cfg.unit === "/s" ? "" : cfg.unit}
        </span>
      </div>

      {/* Hover: subtle scan line */}
      {hovered && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-zk-green/30 to-transparent"
          style={{ animation: "zk-scanline 1s ease-out both" }}
        />
      )}
    </div>
  );
});

// ─── Live clock ───────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", {
        hour12:  false,
        hour:    "2-digit",
        minute:  "2-digit",
        second:  "2-digit",
      });
    setTime(fmt());
    const iv = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <span className="font-mono text-xs text-zk-green/70 tabular-nums tracking-wider">
      {time}
    </span>
  );
}

function initMetrics(): Record<string, MetricState> {
  const s: Record<string, MetricState> = {};
  for (const m of METRICS) s[m.key] = { current: m.init, history: [m.init] };
  return s;
}

// ─── Main component ──────────────────────────────────────────
export function LiveMonitor() {
  const [metrics,  setMetrics]  = useState<Record<string, MetricState>>(initMetrics);
  const [procs,    setProcs]    = useState<Process[]>(INITIAL_PROCS);
  const [hoveredPid, setHoveredPid] = useState<number | null>(null);

  const tickRef = useRef(0);

  // Metric ticker
  useEffect(() => {
    const iv = setInterval(() => {
      setMetrics(prev => {
        const next = { ...prev };
        for (const m of METRICS) {
          const old  = prev[m.key];
          const val  = randomWalk(old.current, m.drift, m.lo, m.hi);
          const hist = [...old.history, val].slice(-28);
          next[m.key] = { current: val, history: hist };
        }
        return next;
      });
    }, 600);
    return () => clearInterval(iv);
  }, []);

  // Process CPU/status ticker
  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current++;
      setProcs(prev =>
        prev
          .map(p => ({
            ...p,
            cpu: clamp(p.cpu + (Math.random() - 0.48) * 1.2, 0.0, 18),
            // occasionally flip status
            status: (Math.random() > 0.92 ? (p.status === "R" ? "S" : "R") : p.status) as "R" | "S",
          }))
          // sort by CPU descending
          .sort((a, b) => b.cpu - a.cpu)
      );
    }, 800);
    return () => clearInterval(iv);
  }, []);

  return (
    <section id="live-monitor" className="relative py-20 px-6">
      <div className="max-w-4xl mx-auto">

        {/* ── Section header ──────────────────────────────── */}
        <div className="mb-12 text-center">
          <p className="section-label mb-3">// SYSTEM_VITALS</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-zk-white leading-tight mb-4">
            Live{" "}
            <span className="font-mono text-zk-green text-glow-sm">Monitor</span>
          </h2>
          <p className="text-zk-slate text-lg max-w-xl mx-auto leading-relaxed">
            Real-time system telemetry. Every bar, number, and process is live.
          </p>
        </div>

        {/* ── Metric cards ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {METRICS.map(cfg => (
            <MetricCard key={cfg.key} cfg={cfg} state={metrics[cfg.key]} />
          ))}
        </div>

        {/* ── Process table ───────────────────────────────── */}
        <div className="terminal-block shadow-[0_0_50px_rgba(0,255,65,0.05)]">
          {/* Table header bar */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-zk-green/15 bg-black/40">
            <span className="font-mono text-[10px] text-zk-green/70 tracking-widest">
              PROCESS TABLE
            </span>
            <LiveClock />
          </div>

          {/* Column labels */}
          <div className="grid grid-cols-[56px_1fr_72px_72px_40px] gap-x-3 px-5 py-2 border-b border-zk-border/60">
            {["PID", "NAME", "CPU %", "MEM MB", "ST"].map(h => (
              <span key={h} className="font-mono text-[9px] text-zk-muted/60 tracking-widest uppercase">
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-zk-border/30">
            {procs.map(p => {
              const isHot     = p.cpu > 8;
              const isHovered = hoveredPid === p.pid;
              return (
                <div
                  key={p.pid}
                  className={cn(
                    "grid grid-cols-[56px_1fr_72px_72px_40px] gap-x-3 px-5 py-2.5 transition-colors duration-150 cursor-default",
                    isHovered ? "bg-zk-green/5" : "hover:bg-white/[0.02]"
                  )}
                  onMouseEnter={() => setHoveredPid(p.pid)}
                  onMouseLeave={() => setHoveredPid(null)}
                >
                  <span className="font-mono text-xs text-zk-muted/70 tabular-nums">
                    {p.pid}
                  </span>
                  <span className={cn(
                    "font-mono text-xs truncate",
                    isHot ? "text-zk-amber" : "text-zk-white"
                  )}>
                    {p.name}
                  </span>
                  <span className={cn(
                    "font-mono text-xs tabular-nums text-right",
                    isHot ? "text-zk-amber" : "text-zk-muted"
                  )}>
                    {p.cpu.toFixed(1)}
                  </span>
                  <span className="font-mono text-xs text-zk-muted tabular-nums text-right">
                    {p.mem.toFixed(1)}
                  </span>
                  <span className={cn(
                    "font-mono text-[10px] text-center",
                    p.status === "R" ? "text-zk-green" : "text-zk-muted/50"
                  )}>
                    {p.status}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-zk-border/40 flex items-center justify-between bg-black/20">
            <span className="font-mono text-[10px] text-zk-muted/50">
              {procs.length} processes &nbsp;·&nbsp; {procs.filter(p => p.status === "R").length} running
            </span>
            <span className="font-mono text-[10px] text-zk-muted/50">
              UPTIME 847d 14h
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
