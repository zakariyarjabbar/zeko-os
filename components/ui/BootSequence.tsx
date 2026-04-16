// components/ui/BootSequence.tsx
// Reworked: Circular HUD ring boot animation.
// Phases: cursor → init → log stream → final fill → SYSTEM READY → fade out.
// Ring progress fills clockwise, quadrant labels light up at 25% intervals.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LOG_LINES = [
  "Initializing hardware abstraction layer......... OK",
  "Mounting encrypted volumes...................... OK",
  "Loading kernel modules.......................... OK",
  "Verifying cryptographic signatures.............. OK",
  "Decrypting payload.............................. OK",
  "Establishing secure memory zones................ OK",
  "Loading user protocols.......................... OK",
  "Binding network interfaces...................... OK",
  "Starting telemetry daemon....................... OK",
  "Syncing system clock............................ OK",
  "Compiling runtime environment................... OK",
  "All systems nominal............................. OK",
];

// ─── Ring geometry (all inside a 440×320 SVG viewBox) ─────────
const CX   = 220;
const CY   = 160;
const R    = 108;
const CIRC = 2 * Math.PI * R; // ≈ 678.6

type Phase = "cursor" | "typing" | "logs" | "progress" | "ready" | "fadeout";

// ─── Quadrant label rendered inside the SVG ───────────────────
function QuadLabel({
  x, y, text, lit, anchor = "middle",
}: {
  x: number; y: number; text: string; lit: boolean;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={`"JetBrains Mono", "Fira Code", monospace`}
      fontSize={9}
      letterSpacing={2}
      fill={lit ? "rgba(0,255,65,0.72)" : "rgba(0,255,65,0.14)"}
      style={{
        filter: lit ? "drop-shadow(0 0 5px rgba(0,255,65,0.5))" : "none",
        transition: "fill 0.4s ease, filter 0.4s ease",
        textTransform: "uppercase",
      }}
    >
      {text}
    </text>
  );
}

// ─── Circular HUD ring (pure SVG, responsive via viewBox) ─────
function HudRing({
  progress, phase, readyFlash,
}: {
  progress: number;
  phase: Phase;
  readyFlash: boolean;
}) {
  const dashOffset = CIRC * (1 - progress / 100);
  const isReady    = phase === "ready";
  const showPct    = ["logs", "progress", "ready"].includes(phase) && progress > 0;

  // Orbiting dot at arc tip
  const tipAngle = ((progress / 100) * 360 - 90) * (Math.PI / 180);
  const tipX     = CX + R * Math.cos(tipAngle);
  const tipY     = CY + R * Math.sin(tipAngle);
  const showTip  = progress > 1 && progress < 99;

  const statusWord =
    phase === "cursor"   ? "STANDBY"  :
    phase === "typing"   ? "INIT"     :
    phase === "logs"     ? "LOADING"  :
    phase === "progress" ? "RUNTIME"  :
                           "READY";

  return (
    <svg
      viewBox="0 0 440 320"
      width="100%"
      style={{ maxWidth: 440, overflow: "visible" }}
      aria-hidden="true"
    >
      {/* ── 60 tick marks ──────────────────────────────────── */}
      {Array.from({ length: 60 }, (_, i) => {
        const a     = ((i / 60) * 360 - 90) * (Math.PI / 180);
        const major = i % 5 === 0;
        const r1    = R + 6;
        const r2    = R + 6 + (major ? 8 : 4);
        return (
          <line
            key={i}
            x1={CX + r1 * Math.cos(a)} y1={CY + r1 * Math.sin(a)}
            x2={CX + r2 * Math.cos(a)} y2={CY + r2 * Math.sin(a)}
            stroke={`rgba(0,255,65,${major ? 0.22 : 0.08})`}
            strokeWidth={major ? 1 : 0.5}
          />
        );
      })}

      {/* ── Track ring ─────────────────────────────────────── */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(0,255,65,0.07)"
        strokeWidth={1.5}
      />

      {/* ── Progress arc ───────────────────────────────────── */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="#00FF41"
        strokeWidth={isReady ? 2.5 : 1.8}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{
          transition: "stroke-dashoffset 0.06s linear",
          filter: `drop-shadow(0 0 ${isReady && readyFlash ? "14px" : "4px"} rgba(0,255,65,${isReady && readyFlash ? "0.9" : "0.5"}))`,
        }}
      />

      {/* ── Inner decorative dashed ring ───────────────────── */}
      <circle
        cx={CX} cy={CY} r={R - 22}
        fill="none"
        stroke="rgba(0,255,65,0.05)"
        strokeWidth={1}
        strokeDasharray="3 10"
      />

      {/* ── Orbiting dot at arc tip ─────────────────────────── */}
      {showTip && (
        <circle
          cx={tipX} cy={tipY} r={4}
          fill="#00FF41"
          style={{ filter: "drop-shadow(0 0 7px rgba(0,255,65,0.95))" }}
        />
      )}

      {/* ── Cursor-phase: pulsing center dot ───────────────── */}
      {phase === "cursor" && (
        <motion.circle
          cx={CX} cy={CY} r={6}
          fill="#00FF41"
          animate={{ opacity: [1, 0.12] }}
          transition={{ duration: 0.85, repeat: Infinity, repeatType: "reverse" }}
          style={{ filter: "drop-shadow(0 0 8px rgba(0,255,65,0.8))" }}
        />
      )}

      {/* ── Center: Z:// logo ──────────────────────────────── */}
      {phase !== "cursor" && (
        <text
          x={CX} y={CY - 14}
          textAnchor="middle"
          fontFamily={`"JetBrains Mono", "Fira Code", monospace`}
          fontSize={20}
          fontWeight="bold"
          fill={isReady && readyFlash ? "#00FF41" : "rgba(0,255,65,0.88)"}
          style={{
            filter: isReady && readyFlash
              ? "drop-shadow(0 0 14px rgba(0,255,65,1))"
              : "drop-shadow(0 0 5px rgba(0,255,65,0.35))",
          }}
        >
          Z://
        </text>
      )}

      {/* ── Center: status word ────────────────────────────── */}
      {phase !== "cursor" && (
        <text
          x={CX} y={CY + 6}
          textAnchor="middle"
          fontFamily={`"JetBrains Mono", "Fira Code", monospace`}
          fontSize={9}
          fill="rgba(107,122,107,0.75)"
          letterSpacing={2}
        >
          {statusWord}
        </text>
      )}

      {/* ── Center: percentage ─────────────────────────────── */}
      {showPct && (
        <text
          x={CX} y={CY + 36}
          textAnchor="middle"
          fontFamily={`"JetBrains Mono", "Fira Code", monospace`}
          fontSize={28}
          fontWeight="bold"
          fill={isReady && readyFlash ? "#00FF41" : "rgba(0,255,65,0.8)"}
          style={{
            filter: isReady && readyFlash
              ? "drop-shadow(0 0 16px rgba(0,255,65,0.95))"
              : "none",
          }}
        >
          {Math.round(progress)}%
        </text>
      )}

      {/* ── Quadrant labels (light up at 1 / 25 / 50 / 75%) ─ */}
      <QuadLabel x={CX}          y={CY - R - 18} text="KERNEL"   lit={progress >= 1}  anchor="middle" />
      <QuadLabel x={CX + R + 22} y={CY + 4}      text="NETWORK"  lit={progress >= 25} anchor="start"  />
      <QuadLabel x={CX}          y={CY + R + 24} text="RUNTIME"  lit={progress >= 50} anchor="middle" />
      <QuadLabel x={CX - R - 22} y={CY + 4}      text="SECURITY" lit={progress >= 75} anchor="end"    />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────
interface BootSequenceProps {
  onComplete: () => void;
}

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase,       setPhase]       = useState<Phase>("cursor");
  const [progress,    setProgress]    = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [readyFlash,  setReadyFlash]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    async function run() {
      // ① Cursor pause — 600ms
      await delay(600);
      if (cancelled) return;

      // ② Init phase — ring 0 → 8%
      setPhase("typing");
      for (let i = 1; i <= 8; i++) {
        if (cancelled) return;
        setProgress(i);
        await delay(50);
      }
      await delay(180);
      if (cancelled) return;

      // ③ Log stream — ring 8 → 68%
      setPhase("logs");
      const step = (68 - 8) / LOG_LINES.length; // 5% per line
      for (let i = 0; i < LOG_LINES.length; i++) {
        if (cancelled) return;
        setVisibleLogs(prev => [...prev, LOG_LINES[i]]);
        setProgress(Math.round(8 + (i + 1) * step));
        await delay(100);
      }
      await delay(150);
      if (cancelled) return;

      // ④ Final fill — ring 68 → 100%
      setPhase("progress");
      for (let p = 69; p <= 100; p++) {
        if (cancelled) return;
        setProgress(p);
        await delay(22);
      }
      await delay(200);
      if (cancelled) return;

      // ⑤ SYSTEM READY flash (3 blinks)
      setPhase("ready");
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        setReadyFlash(true);
        await delay(180);
        setReadyFlash(false);
        await delay(120);
      }
      setReadyFlash(true);
      await delay(500);
      if (cancelled) return;

      // ⑥ Fade out
      setPhase("fadeout");
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {phase !== "fadeout" && (
        <motion.div
          key="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: "#050505",
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,255,65,0.045) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        >
          {/* ── Corner labels ───────────────────────────────── */}
          <span className="absolute top-4 left-6 font-mono text-[10px] text-zk-green/25 tracking-widest select-none">
            ZEKO_BIOS v1.0.0
          </span>
          <span className="absolute top-4 right-6 font-mono text-[10px] text-zk-green/25 tracking-widest select-none">
            ARCH=x86_64
          </span>
          <span className="absolute bottom-4 left-6 font-mono text-[10px] text-zk-green/25 tracking-widest select-none">
            MEM_OK &nbsp;·&nbsp; CPU_OK &nbsp;·&nbsp; SEC_OK
          </span>

          {/* ── Main content ────────────────────────────────── */}
          <div className="flex flex-col items-center gap-4 px-4 w-full">

            {/* HUD ring */}
            <div className="w-full" style={{ maxWidth: 440 }}>
              <HudRing
                progress={progress}
                phase={phase}
                readyFlash={readyFlash}
              />
            </div>

            {/* Log stream — last 4 lines */}
            {(["logs", "progress", "ready"] as Phase[]).includes(phase) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full space-y-0.5"
                style={{ maxWidth: 440 }}
              >
                {visibleLogs.slice(-4).map((line, i, arr) => {
                  const idx = visibleLogs.length - arr.length + i;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.12 }}
                      className="font-mono text-[10px] whitespace-pre truncate"
                      style={{ color: "rgba(0,255,65,0.48)" }}
                    >
                      <span style={{ color: "rgba(0,255,65,0.2)", marginRight: 6 }}>
                        [{String(idx + 1).padStart(2, "0")}]
                      </span>
                      {line}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* SYSTEM READY */}
            {phase === "ready" && (
              <motion.div
                animate={{ opacity: readyFlash ? 1 : 0.08 }}
                transition={{ duration: 0.1 }}
                className="font-mono text-lg font-bold tracking-[0.3em] select-none text-glow"
                style={{ color: "#00FF41" }}
              >
                ██ SYSTEM READY ██
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
