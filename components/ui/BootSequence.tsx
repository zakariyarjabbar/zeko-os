// components/ui/BootSequence.tsx
// Full-screen BIOS/terminal boot animation.
// Sequence: cursor → title typing → log stream → progress bar → SYSTEM READY → fade out.
// Calls onComplete() when the overlay finishes so the parent can unmount it.

"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Log lines ────────────────────────────────────────────────
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

// ─── ASCII progress bar ───────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const WIDTH = 40;
  const filled = Math.round((pct / 100) * WIDTH);
  const empty  = WIDTH - filled;
  const bar    = "█".repeat(filled) + "░".repeat(empty);
  const label  = String(pct).padStart(3, " ");
  return (
    <span className="font-mono text-xs text-zk-green whitespace-pre">
      {"["}
      {bar}
      {"] "}
      {label}
      {"%"}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────
interface BootSequenceProps {
  onComplete: () => void;
}

// ─── Phases ───────────────────────────────────────────────────
type Phase =
  | "cursor"       // blinking cursor only
  | "typing"       // typing the title line
  | "logs"         // streaming log lines
  | "progress"     // filling progress bar
  | "ready"        // SYSTEM READY flash
  | "fadeout";     // opacity fade → unmount

// ─── Component ────────────────────────────────────────────────
export function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase]           = useState<Phase>("cursor");
  const [titleText, setTitleText]   = useState("");
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [progress, setProgress]     = useState(0);
  const [readyFlash, setReadyFlash] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log area as lines appear
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleLogs]);

  // ── Master sequence ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) =>
      new Promise<void>((res) => setTimeout(res, ms));

    async function run() {
      // Phase 1: blinking cursor — 900ms
      await delay(900);
      if (cancelled) return;

      // Phase 2: type the title
      setPhase("typing");
      const TITLE = "ZEKO OS v1.0.0  —  INITIALIZATION SEQUENCE";
      for (let i = 1; i <= TITLE.length; i++) {
        if (cancelled) return;
        setTitleText(TITLE.slice(0, i));
        await delay(38);
      }
      await delay(300);
      if (cancelled) return;

      // Phase 3: stream log lines
      setPhase("logs");
      for (const line of LOG_LINES) {
        if (cancelled) return;
        setVisibleLogs((prev) => [...prev, line]);
        await delay(110);
      }
      await delay(200);
      if (cancelled) return;

      // Phase 4: progress bar
      setPhase("progress");
      for (let p = 0; p <= 100; p += 2) {
        if (cancelled) return;
        setProgress(p);
        await delay(28);
      }
      setProgress(100);
      await delay(300);
      if (cancelled) return;

      // Phase 5: SYSTEM READY flash
      setPhase("ready");
      setShowCursor(false);
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

      // Phase 6: fade out
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
          className="fixed inset-0 z-[9999] flex flex-col items-start justify-center bg-black px-8 sm:px-16 md:px-24 overflow-hidden"
          // Slight scanline texture
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.015) 2px, rgba(0,255,65,0.015) 4px)",
          }}
        >
          {/* ── Corner labels ──────────────────────────────── */}
          <span className="absolute top-4 left-6 font-mono text-[10px] text-zk-green/30 tracking-widest select-none">
            ZEKO_BIOS v1.0.0
          </span>
          <span className="absolute top-4 right-6 font-mono text-[10px] text-zk-green/30 tracking-widest select-none">
            ARCH=x86_64
          </span>
          <span className="absolute bottom-4 left-6 font-mono text-[10px] text-zk-green/30 tracking-widest select-none">
            MEM_OK &nbsp;|&nbsp; CPU_OK &nbsp;|&nbsp; SEC_OK
          </span>

          {/* ── Main terminal content ───────────────────────── */}
          <div className="w-full max-w-3xl space-y-4">

            {/* Blinking cursor (phase: cursor) */}
            {phase === "cursor" && (
              <span
                className="inline-block w-3 h-5 bg-zk-green animate-cursor-blink"
                aria-hidden="true"
              />
            )}

            {/* Title line */}
            {(phase !== "cursor") && (
              <div className="font-mono text-sm sm:text-base text-zk-green font-bold tracking-widest">
                {titleText}
                {phase === "typing" && (
                  <span
                    className="inline-block w-2.5 h-4 bg-zk-green animate-cursor-blink align-bottom ml-0.5"
                    aria-hidden="true"
                  />
                )}
              </div>
            )}

            {/* Separator */}
            {(phase === "logs" || phase === "progress" || phase === "ready") && (
              <div className="font-mono text-[10px] text-zk-green/30 tracking-widest select-none">
                {"─".repeat(60)}
              </div>
            )}

            {/* Log stream */}
            {(phase === "logs" || phase === "progress" || phase === "ready") && (
              <div
                ref={logRef}
                className="h-48 overflow-hidden space-y-0.5"
              >
                {visibleLogs.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="font-mono text-[11px] sm:text-xs text-zk-green/80 whitespace-pre"
                  >
                    <span className="text-zk-green/40 mr-2 select-none">
                      [{String(i + 1).padStart(2, "0")}]
                    </span>
                    {line}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {(phase === "progress" || phase === "ready") && (
              <div className="space-y-1.5">
                <div className="font-mono text-[10px] text-zk-green/50 tracking-widest">
                  LOADING RUNTIME ENVIRONMENT
                </div>
                <ProgressBar pct={progress} />
              </div>
            )}

            {/* SYSTEM READY */}
            {phase === "ready" && (
              <motion.div
                animate={{ opacity: readyFlash ? 1 : 0.15 }}
                transition={{ duration: 0.1 }}
                className="font-mono text-lg sm:text-2xl font-bold text-zk-green tracking-[0.3em] text-glow mt-2"
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
