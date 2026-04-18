// components/sections/Hero.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";
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

// ─── Topology nodes & edges ───────────────────────────────────────
const TOPO_NODES = [
  { x: 200, y: 108, r: 19, label: "KERNEL",   letter: "K", cyan: false },
  { x: 76,  y: 52,  r: 13, label: "SECURITY", letter: "S", cyan: true  },
  { x: 324, y: 52,  r: 13, label: "NETWORK",  letter: "N", cyan: true  },
  { x: 76,  y: 166, r: 13, label: "AUTH",     letter: "A", cyan: false },
  { x: 324, y: 166, r: 13, label: "RUNTIME",  letter: "R", cyan: false },
] as const;

const TOPO_EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [3, 4],
] as const;

// ─── Hooks ───────────────────────────────────────────────────────
function useTyping(text: string, speed = 38, startDelay = 0) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    const t0 = setTimeout(() => {
      let i = 0;
      iv = setInterval(() => {
        i++;
        setOut(text.slice(0, i));
        if (i >= text.length) { setDone(true); clearInterval(iv); }
      }, speed);
    }, startDelay);
    return () => { clearTimeout(t0); clearInterval(iv); };
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

function Counter({ value, suffix = "", delay = 0 }: { value: number; suffix?: string; delay?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      const step = value / (1400 / 16);
      let cur = 0;
      iv = setInterval(() => {
        cur = Math.min(cur + step, value);
        setN(cur);
        if (cur >= value) clearInterval(iv);
      }, 16);
    }, delay);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [value, delay]);
  return <>{value % 1 ? n.toFixed(2) : Math.floor(n)}{suffix}</>;
}

// ─── Pre-computed dot grid for topology (400×218, 20px spacing) ──
const TOPO_W = 400, TOPO_H = 218;
const GRID_DOTS: { x: number; y: number }[] = [];
for (let x = 18; x < TOPO_W; x += 20)
  for (let y = 14; y < TOPO_H; y += 20)
    GRID_DOTS.push({ x, y });

// ─── Module Topology Canvas ───────────────────────────────────────
function SystemTopology() {
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    const W = TOPO_W, H = TOPO_H;
    cv.width = W; cv.height = H;

    type Pkt = { ei: number; p: number; speed: number; rev: boolean };
    const pkts: Pkt[] = [];

    const spawnTimer = setInterval(() => {
      if (pkts.length >= 10) return;
      const ei = Math.floor(Math.random() * TOPO_EDGES.length);
      pkts.push({ ei, p: 0, speed: 0.007 + Math.random() * 0.013, rev: Math.random() < 0.5 });
    }, 500);

    let raf = 0, t = 0;

    function frame() {
      raf = requestAnimationFrame(frame);
      t += 0.016;
      cx!.clearRect(0, 0, W, H);

      // ── Dot grid (positions pre-computed at module load) ────
      cx!.fillStyle = "rgba(0,255,65,0.028)";
      for (const d of GRID_DOTS) {
        cx!.beginPath(); cx!.arc(d.x, d.y, 0.65, 0, Math.PI * 2); cx!.fill();
      }

      // ── Edges ────────────────────────────────────────────────
      for (const [ai, bi] of TOPO_EDGES) {
        const na = TOPO_NODES[ai], nb = TOPO_NODES[bi];

        // Outer glow line
        cx!.beginPath(); cx!.moveTo(na.x, na.y); cx!.lineTo(nb.x, nb.y);
        cx!.strokeStyle = "rgba(0,255,65,0.06)";
        cx!.lineWidth = 4; cx!.setLineDash([]); cx!.stroke();

        // Animated dashed core
        cx!.beginPath(); cx!.moveTo(na.x, na.y); cx!.lineTo(nb.x, nb.y);
        cx!.setLineDash([5, 9]);
        cx!.lineDashOffset = -(t * 22);
        cx!.strokeStyle = "rgba(0,255,65,0.13)";
        cx!.lineWidth = 0.9; cx!.stroke();
        cx!.setLineDash([]);
      }

      // ── Packets ──────────────────────────────────────────────
      for (let i = pkts.length - 1; i >= 0; i--) {
        const pkt = pkts[i];
        const [ai, bi] = TOPO_EDGES[pkt.ei];
        const na = TOPO_NODES[ai], nb = TOPO_NODES[bi];
        const pp  = pkt.rev ? 1 - pkt.p : pkt.p;
        const px  = na.x + (nb.x - na.x) * pp;
        const py  = na.y + (nb.y - na.y) * pp;

        // Trail
        for (let k = 1; k <= 4; k++) {
          const tp  = Math.max(0, pkt.rev ? 1 - (pkt.p - k * 0.018) : pkt.p - k * 0.018);
          const tx  = na.x + (nb.x - na.x) * tp;
          const ty  = na.y + (nb.y - na.y) * tp;
          cx!.beginPath(); cx!.arc(tx, ty, 1.1, 0, Math.PI * 2);
          cx!.fillStyle = `rgba(0,212,255,${0.14 - k * 0.03})`; cx!.fill();
        }

        // Glow halo
        const g = cx!.createRadialGradient(px, py, 0, px, py, 6);
        g.addColorStop(0, "rgba(0,212,255,0.92)");
        g.addColorStop(1, "rgba(0,212,255,0)");
        cx!.beginPath(); cx!.arc(px, py, 6, 0, Math.PI * 2);
        cx!.fillStyle = g; cx!.fill();

        // Core
        cx!.beginPath(); cx!.arc(px, py, 1.6, 0, Math.PI * 2);
        cx!.fillStyle = "rgba(0,212,255,1)"; cx!.fill();

        pkt.p += pkt.speed;
        if (pkt.p >= 1) pkts.splice(i, 1);
      }

      // ── Nodes — set shared ctx state once before the loop ────
      cx!.textAlign    = "center";
      cx!.textBaseline = "middle";
      for (let i = 0; i < TOPO_NODES.length; i++) {
        const n     = TOPO_NODES[i];
        const pulse = Math.sin(t * 2.2 + i * 1.1) * 0.25 + 0.75;
        const [r, g, b] = n.cyan ? [0, 212, 255] : [0, 255, 65];

        // Outer soft pulse ring
        const outerR = n.r + 4 + pulse * 5;
        const rg = cx!.createRadialGradient(n.x, n.y, n.r + 1, n.x, n.y, outerR + 8);
        rg.addColorStop(0, `rgba(${r},${g},${b},${0.15 * pulse})`);
        rg.addColorStop(1, `rgba(${r},${g},${b},0)`);
        cx!.beginPath(); cx!.arc(n.x, n.y, outerR + 8, 0, Math.PI * 2);
        cx!.fillStyle = rg; cx!.fill();

        // Fill
        cx!.beginPath(); cx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        cx!.fillStyle = "#060d06"; cx!.fill();

        // Inner glow fill
        const ig = cx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        ig.addColorStop(0, `rgba(${r},${g},${b},${0.07 * pulse})`);
        ig.addColorStop(1, `rgba(${r},${g},${b},0)`);
        cx!.beginPath(); cx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        cx!.fillStyle = ig; cx!.fill();

        // Border ring
        cx!.beginPath(); cx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        cx!.strokeStyle = `rgba(${r},${g},${b},${0.45 + pulse * 0.35})`;
        cx!.lineWidth   = 1; cx!.stroke();

        // Letter
        cx!.font      = `bold ${i === 0 ? 11 : 9}px "JetBrains Mono", monospace`;
        cx!.fillStyle = `rgba(${r},${g},${b},${0.75 + pulse * 0.2})`;
        cx!.fillText(n.letter, n.x, n.y);

        // Label below
        cx!.font      = `7px "JetBrains Mono", monospace`;
        cx!.fillStyle = `rgba(${r},${g},${b},0.38)`;
        cx!.fillText(n.label, n.x, n.y + n.r + 10);
      }

      // ── v1.0.0 sub-label under KERNEL ────────────────────────
      cx!.font      = '6px "JetBrains Mono", monospace';
      cx!.fillStyle = "rgba(0,255,65,0.22)";
      // textAlign is still "center" from the node loop above
      cx!.fillText("v1.0.0", TOPO_NODES[0].x, TOPO_NODES[0].y + TOPO_NODES[0].r + 19);
    }

    frame();
    return () => { cancelAnimationFrame(raf); clearInterval(spawnTimer); };
  }, []);

  return (
    <canvas
      ref={cvRef}
      aria-hidden="true"
      className="w-full block"
      style={{ height: TOPO_H, willChange: "transform" }}
      suppressHydrationWarning
    />
  );
}

// ─── Framer Motion variants ───────────────────────────────────────
const fadeUp = (delay: number) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const },
});
const fadeIn = (delay: number) => ({
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  transition: { duration: 0.55, delay },
});

// ─── Component ───────────────────────────────────────────────────
export function Hero() {
  const clock                       = useClock();
  const [logIdx, setLogIdx]         = useState(0);
  const { out: cmd, done: cmdDone } = useTyping("initialize --env=prod --arch=x86_64", 36, 700);

  useEffect(() => {
    if (logIdx >= BOOT_LOGS.length) return;
    const t = setTimeout(() => setLogIdx(i => i + 1), 280 + Math.random() * 220);
    return () => clearTimeout(t);
  }, [logIdx]);

  return (
    <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-16">

      {/* ── Glitch keyframes ────────────────────────────────────── */}
      <style>{`
        @keyframes glitch-top {
          0%,82%,100% { clip-path:inset(0 0 96% 0); transform:translate(0,0); opacity:0; }
          84%  { clip-path:inset(10% 0 78% 0); transform:translate(-3px,0) skew(-0.5deg); opacity:0.85; color:#00D4FF; }
          87%  { clip-path:inset(42% 0 42% 0); transform:translate(2px,0);  opacity:0.7;  color:#00D4FF; }
          90%  { clip-path:inset(70% 0 14% 0); transform:translate(-1px,0); opacity:0.6;  color:#00D4FF; }
          92%  { clip-path:inset(0 0 96% 0);   transform:translate(0,0);   opacity:0; }
        }
        @keyframes glitch-bottom {
          0%,86%,100% { clip-path:inset(92% 0 0 0); transform:translate(0,0); opacity:0; }
          88%  { clip-path:inset(75% 0 8% 0);  transform:translate(3px,0) skew(0.5deg); opacity:0.8; color:#FF3B3B; }
          91%  { clip-path:inset(50% 0 32% 0); transform:translate(-2px,0); opacity:0.6; color:#FF3B3B; }
          94%  { clip-path:inset(88% 0 0 0);   transform:translate(0,0); opacity:0; }
        }
        .glitch { position:relative; display:inline-block; }
        .glitch::before, .glitch::after {
          content:attr(data-text); position:absolute; inset:0;
          font:inherit; line-height:inherit; letter-spacing:inherit;
          white-space:nowrap; pointer-events:none;
        }
        .glitch::before { animation: glitch-top    4.5s infinite linear 1.5s; }
        .glitch::after  { animation: glitch-bottom 4.5s infinite linear 2.0s; }
      `}</style>

      {/* ── Subtle radial glow ──────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 70% 55% at 30% 48%, rgba(0,255,65,0.03) 0%, transparent 70%)",
      }} />

      {/* Perspective grid floor */}
      <div className="absolute bottom-0 left-0 right-0 h-56 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(0,255,65,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,65,0.06) 1px, transparent 1px)
        `,
        backgroundSize:  "52px 26px",
        transform:        "perspective(350px) rotateX(58deg)",
        transformOrigin:  "bottom",
        maskImage:        "linear-gradient(to top, rgba(0,0,0,0.18) 0%, transparent 100%)",
        WebkitMaskImage:  "linear-gradient(to top, rgba(0,0,0,0.18) 0%, transparent 100%)",
      }} />

      {/* Corner HUD brackets */}
      <div className="absolute top-[72px] left-5  w-4 h-4 border-t border-l border-zk-green/20 pointer-events-none" aria-hidden="true" />
      <div className="absolute top-[72px] right-5 w-4 h-4 border-t border-r border-zk-green/20 pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-5  left-5  w-4 h-4 border-b border-l border-zk-green/20 pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-5  right-5 w-4 h-4 border-b border-r border-zk-green/20 pointer-events-none" aria-hidden="true" />

      {/* Top HUD strip */}
      <div className="absolute top-[78px] left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-5 pointer-events-none select-none" aria-hidden="true">
        <span className="font-mono text-[9px] text-zk-green/22 tracking-widest">SESSION:{clock}</span>
        <span className="font-mono text-[9px] text-zk-green/10">·</span>
        <span className="font-mono text-[9px] text-zk-green/22 tracking-widest">PID:0001</span>
        <span className="font-mono text-[9px] text-zk-green/10">·</span>
        <span className="font-mono text-[9px] text-zk-green/22 tracking-widest">ENV:PROD</span>
      </div>

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_400px] gap-14 xl:gap-24 items-center">

          {/* ── LEFT ─────────────────────────────────────────────── */}
          <div>

            {/* Command prompt */}
            <motion.div {...fadeIn(0.15)} className="font-mono text-sm mb-8 flex items-center gap-2">
              <span className="text-zk-green/25 select-none">root@zeko-os:~$</span>
              <span className="text-zk-green/60">{cmd}</span>
              {!cmdDone && <span className="w-[7px] h-[13px] bg-zk-green/50 animate-cursor-blink inline-block" />}
            </motion.div>

            {/* Status badge */}
            <motion.div {...fadeUp(0.28)} className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 border border-zk-green/18 bg-zk-green/[0.035]">
              <span className="w-1.5 h-1.5 rounded-full bg-zk-green animate-pulse" style={{ boxShadow: "0 0 5px rgba(0,255,65,0.7)" }} />
              <span className="font-mono text-xs text-zk-green/80 tracking-widest uppercase">System Online — v1.0.0</span>
            </motion.div>

            {/* Headline */}
            <motion.h1 {...fadeUp(0.40)} className="font-bold tracking-tighter leading-[0.88] mb-8"
              style={{ fontSize: "clamp(3.8rem,9.5vw,8rem)" }}
            >
              <span
                className="glitch block font-mono text-zk-green"
                data-text="ZEKO"
                style={{ textShadow: "0 0 30px rgba(0,255,65,0.50), 0 0 80px rgba(0,255,65,0.14)" }}
              >
                ZEKO
              </span>
              <span className="block text-zk-white/85">
                OS<span className="font-mono text-zk-green" style={{ textShadow: "0 0 20px rgba(0,255,65,0.65)" }}>.</span>
              </span>
            </motion.h1>

            {/* Sub-headline */}
            <motion.p {...fadeUp(0.50)} className="max-w-lg text-lg text-zk-slate/85 leading-relaxed mb-3">
              A precision-engineered digital environment for engineers who demand{" "}
              <span className="text-zk-white/90 font-medium">performance, modularity,</span>{" "}
              and <span className="text-zk-green font-mono">zero compromise.</span>
            </motion.p>

            {/* Meta line */}
            <motion.p {...fadeIn(0.60)} className="font-mono text-[11px] text-zk-muted/60 tracking-widest mb-10">
              {">"} KERNEL=1.0.0 &nbsp;·&nbsp; ARCH=x86_64 &nbsp;·&nbsp; ENV=PRODUCTION &nbsp;·&nbsp; BUILD=stable
            </motion.p>

            {/* CTAs */}
            <motion.div {...fadeUp(0.70)} className="flex flex-wrap items-center gap-4 mb-12">
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
            <motion.div {...fadeIn(0.80)}
              className="grid grid-cols-2 sm:grid-cols-4 border border-zk-green/12 divide-x divide-zk-green/12 overflow-hidden"
            >
              {STATS.map((s, i) => (
                <div key={s.label} className="px-4 py-4 text-center hover:bg-zk-green/[0.035] transition-colors duration-300 group">
                  <div className="font-mono text-xl font-bold text-zk-green tabular-nums"
                    style={{ textShadow: "0 0 10px rgba(0,255,65,0.40)" }}
                  >
                    <Counter value={s.value} suffix={s.suffix} delay={1100 + i * 160} />
                  </div>
                  <div className="font-mono text-[9px] text-zk-muted/60 tracking-widest uppercase mt-1 group-hover:text-zk-slate/70 transition-colors">
                    {s.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── RIGHT: Terminal log + Module topology ─────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:flex flex-col gap-3"
          >

            {/* Terminal window */}
            <div className="border border-zk-green/14 bg-[#060d06] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zk-green/10 bg-black/30">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zk-green/40" />
                </div>
                <span className="font-mono text-[10px] text-zk-muted/55 ml-2 tracking-wider">SYSTEM — boot.log</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zk-green animate-pulse" style={{ boxShadow: "0 0 4px rgba(0,255,65,0.65)" }} />
                  <span className="font-mono text-[9px] text-zk-green/45 tracking-widest">LIVE</span>
                </div>
              </div>

              <div className="p-4 space-y-1.5 min-h-[200px]">
                {BOOT_LOGS.slice(0, logIdx).map((log, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.13 }}
                    className="flex items-center gap-3 font-mono text-[11px]"
                  >
                    <span className="text-zk-muted/30 flex-shrink-0 tabular-nums">[{String(i + 1).padStart(2, "0")}]</span>
                    <span className="text-zk-slate/75 flex-1 truncate">{log}</span>
                    <span className="text-zk-green/55 flex-shrink-0 text-[10px]">OK</span>
                  </motion.div>
                ))}
                {logIdx < BOOT_LOGS.length && (
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-zk-muted/30">[{String(logIdx + 1).padStart(2, "0")}]</span>
                    <span className="text-zk-green/40 animate-pulse">processing...</span>
                  </div>
                )}
                {logIdx >= BOOT_LOGS.length && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="flex items-center gap-2 font-mono text-[11px] mt-3 pt-3 border-t border-zk-green/8"
                  >
                    <span className="text-zk-green/30 select-none">root@zeko-os:~$</span>
                    <span className="text-zk-green/60 animate-cursor-blink">_</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Module Topology */}
            <div className="border border-zk-green/14 bg-[#060d06] overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zk-green/10 bg-black/30">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-zk-green/35 animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-zk-cyan/35 animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                  <span className="font-mono text-[10px] text-zk-muted/55 tracking-wider">MODULE TOPOLOGY</span>
                </div>
                <span className="font-mono text-[9px] text-zk-green/30 tracking-widest">5 NODES ACTIVE</span>
              </div>

              {/* Canvas */}
              <div className="px-2 pt-1 pb-2">
                <SystemTopology />
              </div>

              {/* Footer strip */}
              <div className="px-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-zk-green/50" />
                    <span className="font-mono text-[8px] text-zk-muted/40 tracking-wider">KERNEL</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-zk-cyan/50" />
                    <span className="font-mono text-[8px] text-zk-muted/40 tracking-wider">MODULE</span>
                  </span>
                </div>
                <span className="font-mono text-[8px] text-zk-green/22 tracking-widest">LATENCY: 0.4ms</span>
              </div>
            </div>

          </motion.div>

        </div>
      </div>
    </section>
  );
}
