// components/sections/Hero.tsx
// Hero section — glitch headline, HUD ring watermark, live terminal log panel,
// animated system metrics, scanlines, perspective grid floor, corner brackets.

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Terminal, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

// ─── Data ────────────────────────────────────────────────────────
const BOOT_LOGS = [
  "Loading kernel modules",
  "Mounting encrypted volumes",
  "Verifying cryptographic signatures",
  "Establishing secure memory zones",
  "Binding network interfaces",
  "Starting telemetry daemon",
  "Compiling runtime environment",
  "All systems nominal",
] as const;

const STATS = [
  { value: 142,   suffix: "",   label: "Deployments" },
  { value: 98,    suffix: "",   label: "Modules"      },
  { value: 99.97, suffix: "%",  label: "Uptime"       },
  { value: 12,    suffix: "ms", label: "Response"     },
] as const;

const METRICS = [
  { label: "CPU",     pct: 23 },
  { label: "Memory",  pct: 67 },
  { label: "Network", pct: 41 },
  { label: "Disk",    pct: 18 },
];

// ─── Hooks ───────────────────────────────────────────────────────
function useTyping(text: string, speed = 38, startDelay = 0) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t0 = setTimeout(() => {
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setOut(text.slice(0, i));
        if (i >= text.length) { setDone(true); clearInterval(iv); }
      }, speed);
      return () => clearInterval(iv);
    }, startDelay);
    return () => clearTimeout(t0);
  }, [text, speed, startDelay]);
  return { out, done };
}

function useClock() {
  const [clock, setClock] = useState("00:00:00");
  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const e = Date.now() - t0;
      const pad = (n: number) => String(n).padStart(2, "0");
      setClock(`${pad(Math.floor(e / 3600000))}:${pad(Math.floor(e / 60000) % 60)}:${pad(Math.floor(e / 1000) % 60)}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return clock;
}

// ─── Animated counter ────────────────────────────────────────────
function Counter({ value, suffix = "", delay = 0 }: { value: number; suffix?: string; delay?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const step = value / (1400 / 16);
      let cur = 0;
      const iv = setInterval(() => {
        cur = Math.min(cur + step, value);
        setN(cur);
        if (cur >= value) clearInterval(iv);
      }, 16);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return <>{value % 1 ? n.toFixed(2) : Math.floor(n)}{suffix}</>;
}

// ─── Decorative HUD ring (background watermark) ──────────────────
function HudRingBg() {
  const CX = 200, CY = 200, R = 148;
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden="true">
      {Array.from({ length: 72 }, (_, i) => {
        const a = ((i / 72) * 360 - 90) * (Math.PI / 180);
        const major = i % 6 === 0;
        const r1 = R + 6, r2 = R + 6 + (major ? 12 : 5);
        const f = (n: number) => Math.round(n * 1000) / 1000;
        return (
          <line key={i}
            x1={f(CX + r1 * Math.cos(a))} y1={f(CY + r1 * Math.sin(a))}
            x2={f(CX + r2 * Math.cos(a))} y2={f(CY + r2 * Math.sin(a))}
            stroke={`rgba(0,255,65,${major ? 0.18 : 0.07})`}
            strokeWidth={major ? 1 : 0.5}
          />
        );
      })}
      <circle cx={CX} cy={CY} r={R}      fill="none" stroke="rgba(0,255,65,0.08)" strokeWidth={1.5} />
      <circle cx={CX} cy={CY} r={R - 26} fill="none" stroke="rgba(0,255,65,0.04)" strokeWidth={1} strokeDasharray="4 14" />
      <circle cx={CX} cy={CY} r={R - 52} fill="none" stroke="rgba(0,255,65,0.03)" strokeWidth={1} strokeDasharray="2 18" />
      {[
        { x: CX,          y: CY - R - 22, t: "KERNEL",   a: "middle" as const },
        { x: CX + R + 26, y: CY + 5,      t: "NETWORK",  a: "start"  as const },
        { x: CX,          y: CY + R + 28, t: "RUNTIME",  a: "middle" as const },
        { x: CX - R - 26, y: CY + 5,      t: "SECURITY", a: "end"    as const },
      ].map(({ x, y, t, a }) => (
        <text key={t} x={x} y={y} textAnchor={a}
          fontFamily={`"JetBrains Mono", monospace`} fontSize={9} letterSpacing={2}
          fill="rgba(0,255,65,0.1)"
        >{t}</text>
      ))}
      <text x={CX} y={CY - 10} textAnchor="middle"
        fontFamily={`"JetBrains Mono", monospace`} fontSize={28} fontWeight="bold"
        fill="rgba(0,255,65,0.07)"
      >Z://</text>
      <text x={CX} y={CY + 10} textAnchor="middle"
        fontFamily={`"JetBrains Mono", monospace`} fontSize={9} letterSpacing={4}
        fill="rgba(0,255,65,0.05)"
      >ZEKO OS</text>
    </svg>
  );
}

// ─── Framer Motion variants ───────────────────────────────────────
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const },
});
const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, delay },
});

// ─── Component ───────────────────────────────────────────────────
export function Hero() {
  const clock                      = useClock();
  const [logIdx, setLogIdx]        = useState(0);
  const { out: cmd, done: cmdDone } = useTyping("initialize --env=prod --arch=x86_64", 36, 700);

  useEffect(() => {
    if (logIdx >= BOOT_LOGS.length) return;
    const t = setTimeout(() => setLogIdx(i => i + 1), 280 + Math.random() * 220);
    return () => clearTimeout(t);
  }, [logIdx]);

  return (
    <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-16">

      {/* ── Glitch CSS ──────────────────────────────────────────── */}
      <style>{`
        @keyframes glitch-top {
          0%,82%,100% { clip-path:inset(0 0 96% 0); transform:translate(0,0); opacity:0; }
          84%          { clip-path:inset(10% 0 78% 0); transform:translate(-3px,0) skew(-0.5deg); opacity:0.85; color:#00D4FF; }
          87%          { clip-path:inset(42% 0 42% 0); transform:translate(2px,0);  opacity:0.7;  color:#00D4FF; }
          90%          { clip-path:inset(70% 0 14% 0); transform:translate(-1px,0); opacity:0.6;  color:#00D4FF; }
          92%          { clip-path:inset(0 0 96% 0);   transform:translate(0,0);   opacity:0; }
        }
        @keyframes glitch-bottom {
          0%,86%,100% { clip-path:inset(92% 0 0 0); transform:translate(0,0); opacity:0; }
          88%          { clip-path:inset(75% 0 8% 0);  transform:translate(3px,0) skew(0.5deg); opacity:0.8; color:#FF3B3B; }
          91%          { clip-path:inset(50% 0 32% 0); transform:translate(-2px,0); opacity:0.6; color:#FF3B3B; }
          94%          { clip-path:inset(88% 0 0 0);   transform:translate(0,0);   opacity:0; }
        }
        .glitch { position:relative; display:inline-block; }
        .glitch::before, .glitch::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          font: inherit;
          line-height: inherit;
          letter-spacing: inherit;
          white-space: nowrap;
          pointer-events: none;
        }
        .glitch::before { animation: glitch-top    4.5s infinite linear 1.5s; }
        .glitch::after  { animation: glitch-bottom 4.5s infinite linear 2.0s; }
      `}</style>

      {/* ── Background layers ──────────────────────────────────── */}

      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,255,65,0.04) 1px, transparent 0)",
        backgroundSize:  "32px 32px",
      }} />

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)",
      }} />

      {/* Radial glows */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[1100px] h-[700px] rounded-full bg-zk-green/[0.025] blur-[130px]" />
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 pointer-events-none">
        <div className="w-[600px] h-[500px] rounded-full bg-zk-green/[0.04] blur-[90px]" />
      </div>

      {/* HUD ring watermark — large, centered, very faint */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div className="w-[700px] h-[700px] opacity-[0.55]">
          <HudRingBg />
        </div>
      </div>

      {/* Perspective grid floor */}
      <div className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(0,255,65,0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,65,0.07) 1px, transparent 1px)
        `,
        backgroundSize:    "52px 26px",
        transform:         "perspective(350px) rotateX(58deg)",
        transformOrigin:   "bottom",
        maskImage:         "linear-gradient(to top, rgba(0,0,0,0.25), transparent)",
        WebkitMaskImage:   "linear-gradient(to top, rgba(0,0,0,0.25), transparent)",
      }} />

      {/* Corner HUD brackets */}
      <div className="absolute top-[72px] left-5 w-5 h-5 border-t border-l border-zk-green/25 pointer-events-none" aria-hidden="true" />
      <div className="absolute top-[72px] right-5 w-5 h-5 border-t border-r border-zk-green/25 pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-5 left-5 w-5 h-5 border-b border-l border-zk-green/25 pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-5 right-5 w-5 h-5 border-b border-r border-zk-green/25 pointer-events-none" aria-hidden="true" />

      {/* Top HUD strip */}
      <div className="absolute top-[78px] left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-5 pointer-events-none select-none" aria-hidden="true">
        <span className="font-mono text-[9px] text-zk-green/20 tracking-widest">SESSION:{clock}</span>
        <span className="font-mono text-[9px] text-zk-green/12">·</span>
        <span className="font-mono text-[9px] text-zk-green/20 tracking-widest">PID:0001</span>
        <span className="font-mono text-[9px] text-zk-green/12">·</span>
        <span className="font-mono text-[9px] text-zk-green/20 tracking-widest">ENV:PROD</span>
      </div>

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_420px] gap-14 xl:gap-20 items-center">

          {/* ── LEFT: Hero text ──────────────────────────────────── */}
          <div>

            {/* Command prompt */}
            <motion.div {...fadeIn(0.15)} className="font-mono text-sm mb-8 flex items-center gap-2">
              <span className="text-zk-green/30 select-none">root@zeko-os:~$</span>
              <span className="text-zk-green/65">{cmd}</span>
              {!cmdDone && <span className="w-[7px] h-[14px] bg-zk-green/55 animate-cursor-blink inline-block" />}
            </motion.div>

            {/* Status badge */}
            <motion.div {...fadeUp(0.3)} className="inline-flex items-center gap-2 mb-7 px-3 py-1.5 border border-zk-green/20 bg-zk-green/[0.04]">
              <span className="w-1.5 h-1.5 rounded-full bg-zk-green animate-pulse" style={{ boxShadow: "0 0 6px rgba(0,255,65,0.8)" }} />
              <span className="font-mono text-xs text-zk-green tracking-widest uppercase">System Online — v1.0.0</span>
            </motion.div>

            {/* Giant glitch headline */}
            <motion.h1 {...fadeUp(0.42)} className="font-bold tracking-tighter leading-[0.88] mb-7"
              style={{ fontSize: "clamp(3.8rem,9.5vw,8rem)" }}
            >
              <span
                className="glitch block font-mono text-zk-green"
                data-text="ZEKO"
                style={{ textShadow: "0 0 25px rgba(0,255,65,0.55), 0 0 70px rgba(0,255,65,0.18), 0 0 120px rgba(0,255,65,0.06)" }}
              >
                ZEKO
              </span>
              <span className="block text-zk-white/88">
                OS
                <span
                  className="font-mono text-zk-green"
                  style={{ textShadow: "0 0 25px rgba(0,255,65,0.75)" }}
                >.</span>
              </span>
            </motion.h1>

            {/* Sub-headline */}
            <motion.p {...fadeUp(0.52)} className="max-w-xl text-lg sm:text-xl text-zk-slate leading-relaxed mb-4">
              A precision-engineered digital environment built for engineers who demand{" "}
              <span className="text-zk-white font-medium">performance, modularity,</span>{" "}
              and <span className="text-zk-green font-mono">zero compromise.</span>
            </motion.p>

            {/* Meta line */}
            <motion.p {...fadeIn(0.62)} className="font-mono text-xs text-zk-muted tracking-widest mb-10">
              {">"} KERNEL=1.0.0 &nbsp;|&nbsp; ARCH=x86_64 &nbsp;|&nbsp; ENV=PRODUCTION &nbsp;|&nbsp; BUILD=stable
            </motion.p>

            {/* CTAs */}
            <motion.div {...fadeUp(0.72)} className="flex flex-wrap items-center gap-4 mb-12">
              <Link href="/system/overview">
                <Button variant="primary" size="lg" rightIcon={<ArrowRight size={16} />}>
                  Initialize System
                </Button>
              </Link>
              <Button variant="outline" size="lg" leftIcon={<Terminal size={14} />}>
                Open Terminal
              </Button>
            </motion.div>

            {/* Stats bar */}
            <motion.div {...fadeIn(0.82)}
              className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zk-border border border-zk-border overflow-hidden"
            >
              {STATS.map((s, i) => (
                <div key={s.label} className="bg-zk-bg px-4 py-4 text-center hover:bg-zk-green/[0.04] transition-colors duration-200 group">
                  <div className="font-mono text-xl font-bold text-zk-green tabular-nums"
                    style={{ textShadow: "0 0 12px rgba(0,255,65,0.45)" }}
                  >
                    <Counter value={s.value} suffix={s.suffix} delay={1100 + i * 160} />
                  </div>
                  <div className="font-mono text-[9px] text-zk-muted tracking-widest uppercase mt-1 group-hover:text-zk-slate transition-colors">
                    {s.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── RIGHT: Terminal + Metrics ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:flex flex-col gap-4"
          >
            {/* Terminal window */}
            <div className="border border-zk-border bg-zk-bg/90 backdrop-blur-sm overflow-hidden"
              style={{ boxShadow: "0 0 50px rgba(0,255,65,0.04), 0 0 1px rgba(0,255,65,0.12) inset" }}
            >
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zk-border bg-zk-bg/50">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zk-green/50" />
                </div>
                <span className="font-mono text-[10px] text-zk-muted ml-2 tracking-wider">SYSTEM — boot.log</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zk-green animate-pulse" style={{ boxShadow: "0 0 5px rgba(0,255,65,0.7)" }} />
                  <span className="font-mono text-[9px] text-zk-green/55 tracking-widest">LIVE</span>
                </div>
              </div>

              {/* Log content */}
              <div className="p-4 space-y-1.5 min-h-[252px]">
                {BOOT_LOGS.slice(0, logIdx).map((log, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.14 }}
                    className="flex items-center gap-3 font-mono text-[11px]"
                  >
                    <span className="text-zk-muted/35 flex-shrink-0 tabular-nums">[{String(i + 1).padStart(2, "0")}]</span>
                    <span className="text-zk-slate flex-1 truncate">{log}</span>
                    <span className="text-zk-green/65 flex-shrink-0 text-[10px]">OK</span>
                  </motion.div>
                ))}
                {logIdx < BOOT_LOGS.length && (
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-zk-muted/35">[{String(logIdx + 1).padStart(2, "0")}]</span>
                    <span className="text-zk-green/45 animate-pulse">processing...</span>
                  </div>
                )}
                {logIdx >= BOOT_LOGS.length && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="flex items-center gap-2 font-mono text-[11px] mt-3 pt-3 border-t border-zk-border/60"
                  >
                    <span className="text-zk-green/35 select-none">root@zeko-os:~$</span>
                    <span className="text-zk-green/70 animate-cursor-blink">_</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* System metrics */}
            <div className="border border-zk-border bg-zk-bg/90 backdrop-blur-sm p-4"
              style={{ boxShadow: "0 0 50px rgba(0,255,65,0.03)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={11} className="text-zk-green/55" />
                  <span className="font-mono text-[10px] text-zk-muted tracking-widest uppercase">System Metrics</span>
                </div>
                <span className="font-mono text-[9px] text-zk-green/30 tabular-nums">{clock}</span>
              </div>
              <div className="space-y-3">
                {METRICS.map((m, i) => (
                  <div key={m.label}>
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-[9px] text-zk-muted uppercase tracking-widest">{m.label}</span>
                      <span className="font-mono text-[9px] text-zk-green/65 tabular-nums">{m.pct}%</span>
                    </div>
                    <div className="h-px bg-zk-border overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${m.pct}%` }}
                        transition={{ duration: 1.1, delay: 0.9 + i * 0.1, ease: "easeOut" }}
                        className="h-full bg-zk-green"
                        style={{ boxShadow: "2px 0 8px rgba(0,255,65,0.6)" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
