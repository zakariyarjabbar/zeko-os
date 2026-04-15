// components/ui/AuthTransition.tsx
// Full-screen cinematic overlay shown after a successful login or logout.
//
// LOGIN  — green matrix rain, terminal verification lines, "ACCESS GRANTED" finale
// LOGOUT — red matrix rain, glitch shake, "SESSION TERMINATED" finale
//
// The overlay is position:fixed z-[999] so it floats above the entire app.
// Call onComplete() when the animation ends to trigger the router push.

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence }      from "framer-motion";
import { ShieldCheck, ShieldOff }       from "lucide-react";

// ─── Config per mode ──────────────────────────────────────────
type Mode = "login" | "logout";

interface LineConfig { text: string; tag: string; }

const CFG = {
  login: {
    fg:          "#00FF41",
    fgDim:       "rgba(0,255,65,0.55)",
    bg:          "rgba(2, 6, 2, 0.98)",
    rainColor1:  "rgba(0,255,65,",   // + alpha + ")"
    rainColor2:  "rgba(0,180,30,",
    lines: [
      { text: "> CREDENTIALS VERIFIED",      tag: "[  OK  ]" },
      { text: "> IDENTITY CONFIRMED",         tag: "[  OK  ]" },
      { text: "> SECURITY PROFILE LOADED",    tag: "[  OK  ]" },
      { text: "> SESSION INITIALIZED",        tag: "[  OK  ]" },
    ] as LineConfig[],
    headline:    "ACCESS GRANTED",
    Icon:        ShieldCheck,
    glowColor:   "#00FF41",
    flashBg:     "rgba(0,255,65,0.18)",
    lineDelay:   360,
    headlineDelay: 260,
    flashDelay:  700,
    exitDelay:   500,
  },
  logout: {
    fg:          "#FF3B3B",
    fgDim:       "rgba(255,59,59,0.55)",
    bg:          "rgba(6, 2, 2, 0.98)",
    rainColor1:  "rgba(255,59,59,",
    rainColor2:  "rgba(180,30,30,",
    lines: [
      { text: "> TERMINATING SESSION",        tag: "[  OK  ]" },
      { text: "> WIPING CREDENTIALS",          tag: "[  OK  ]" },
      { text: "> CLOSING CONNECTIONS",         tag: "[  OK  ]" },
    ] as LineConfig[],
    headline:    "SESSION TERMINATED",
    Icon:        ShieldOff,
    glowColor:   "#FF3B3B",
    flashBg:     "rgba(255,59,59,0.18)",
    lineDelay:   300,
    headlineDelay: 220,
    flashDelay:  600,
    exitDelay:   420,
  },
} as const;

// ─── Matrix rain canvas ───────────────────────────────────────
function useMatrixRain(
  ref:    React.RefObject<HTMLCanvasElement | null>,
  mode:   Mode,
) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg = CFG[mode];
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const FONT_SIZE = 13;
    const cols = Math.ceil(canvas.width / FONT_SIZE) + 1;
    // Random start positions so the rain is already mid-flow on mount
    const drops: number[] = Array.from({ length: cols }, () =>
      Math.random() * -(canvas.height / FONT_SIZE)
    );

    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*<>:/\\|~`!?";

    let rafId: number;
    let lastTs = 0;
    const INTERVAL = 48; // ~20 fps — intentionally slow for the retro look

    function frame(ts: number) {
      rafId = requestAnimationFrame(frame);
      if (ts - lastTs < INTERVAL) return;
      lastTs = ts;

      // Fade trail
      ctx!.fillStyle = mode === "login" ? "rgba(2,6,2,0.12)" : "rgba(6,2,2,0.12)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      ctx!.font = `${FONT_SIZE}px "JetBrains Mono", "Courier New", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * FONT_SIZE;
        if (y < 0) { drops[i] += 0.4; continue; }

        const ch    = CHARS[Math.floor(Math.random() * CHARS.length)];
        const alpha = Math.random() * 0.45 + 0.08;
        // Leading char is brighter
        const isHead = Math.random() > 0.85;
        ctx!.fillStyle = isHead
          ? `${cfg.rainColor1}${Math.min(alpha + 0.3, 0.9)})`
          : `${cfg.rainColor1}${alpha})`;
        ctx!.fillText(ch, i * FONT_SIZE, y);

        if (y > canvas!.height && Math.random() > 0.975) {
          drops[i] = Math.random() * -20;
        }
        drops[i] += 0.5;
      }
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [ref, mode]);
}

// ─── Component ────────────────────────────────────────────────
interface AuthTransitionProps {
  mode:       Mode;
  onComplete: () => void;
}

export function AuthTransition({ mode, onComplete }: AuthTransitionProps) {
  const cfg         = CFG[mode];
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const completeRef = useRef(onComplete);

  // Keep ref current without re-triggering the timing effect
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  useMatrixRain(canvasRef, mode);

  // ── Animation phase state ─────────────────────────────────
  const [visibleLines, setVisibleLines] = useState(0);
  const [showHeadline, setShowHeadline] = useState(false);
  const [flashing,     setFlashing]     = useState(false);
  const [fadingOut,    setFadingOut]    = useState(false);

  useEffect(() => {
    const T: ReturnType<typeof setTimeout>[] = [];

    cfg.lines.forEach((_, i) => {
      T.push(setTimeout(() => setVisibleLines(i + 1), 250 + i * cfg.lineDelay));
    });

    const afterLines = 250 + cfg.lines.length * cfg.lineDelay;
    T.push(setTimeout(() => setShowHeadline(true),   afterLines + cfg.headlineDelay));
    T.push(setTimeout(() => setFlashing(true),       afterLines + cfg.headlineDelay + cfg.flashDelay));
    T.push(setTimeout(() => setFadingOut(true),      afterLines + cfg.headlineDelay + cfg.flashDelay + 250));
    T.push(setTimeout(() => completeRef.current(),   afterLines + cfg.headlineDelay + cfg.flashDelay + cfg.exitDelay + 250));

    return () => T.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once on mount

  const Icon = cfg.Icon;

  return (
    <motion.div
      key="auth-transition"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[999] overflow-hidden flex items-center justify-center"
      style={{ background: cfg.bg }}
    >
      {/* Matrix rain */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.55 }}
      />

      {/* Horizontal scan line — sweeps top → bottom repeatedly */}
      <motion.div
        className="absolute left-0 right-0 h-[1px] pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${cfg.fg}90 20%, ${cfg.fg} 50%, ${cfg.fg}90 80%, transparent 100%)`,
          boxShadow:  `0 0 6px ${cfg.fg}70, 0 0 18px ${cfg.fg}30`,
          top: 0,
        }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 1.6, ease: "linear", repeat: Infinity, repeatDelay: 0.2 }}
      />

      {/* Corner decorations */}
      {["top-0 left-0",  "top-0 right-0",
        "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
        <div
          key={i}
          className={`absolute ${pos} w-8 h-8 pointer-events-none`}
          style={{
            borderColor: cfg.fg,
            opacity: 0.25,
            borderTopWidth:    i < 2 ? "1px" : "0",
            borderBottomWidth: i >= 2 ? "1px" : "0",
            borderLeftWidth:   i % 2 === 0 ? "1px" : "0",
            borderRightWidth:  i % 2 === 1 ? "1px" : "0",
          }}
        />
      ))}

      {/* ── Center stage ──────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center gap-8">

        {/* Terminal verification block */}
        <div className="w-[420px] space-y-2">
          {/* Header bar */}
          <div
            className="flex items-center gap-2 mb-4 pb-3 font-mono text-[10px] tracking-[0.25em] uppercase"
            style={{ color: cfg.fgDim, borderBottom: `1px solid ${cfg.fg}20` }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: cfg.fg, boxShadow: `0 0 6px ${cfg.fg}` }}
            />
            ZEKO OS — AUTH MODULE
          </div>

          {/* Verification lines */}
          {cfg.lines.map((line, i) => (
            <AnimatePresence key={i}>
              {i < visibleLines && (
                <motion.div
                  initial={{ opacity: 0, x: mode === "logout" ? -6 : 0, y: mode === "login" ? 6 : 0 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between font-mono text-sm"
                >
                  {/* Text — typed character reveal via clip-path trick with a motion span */}
                  <span style={{ color: cfg.fg, opacity: 0.85 }}>{line.text}</span>
                  <span
                    style={{
                      color: cfg.fg,
                      fontSize: "0.7rem",
                      letterSpacing: "0.15em",
                      opacity: 0.7,
                    }}
                  >
                    {line.tag}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          ))}

          {/* Blinking cursor at the bottom while lines are still coming */}
          {visibleLines < cfg.lines.length && (
            <motion.span
              className="inline-block w-2 h-[14px] align-bottom"
              style={{ background: cfg.fg }}
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
            />
          )}
        </div>

        {/* ── Headline ────────────────────────────────────────── */}
        <AnimatePresence>
          {showHeadline && (
            <motion.div
              initial={{ opacity: 0, scale: 0.75, y: 10 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="flex flex-col items-center gap-4"
            >
              {/* Icon with pulsing glow ring */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute w-20 h-20 rounded-full"
                  style={{ background: `radial-gradient(circle, ${cfg.fg}20 0%, transparent 70%)` }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <div
                  className="w-16 h-16 rounded-sm flex items-center justify-center"
                  style={{
                    border:     `1px solid ${cfg.fg}50`,
                    background: `${cfg.fg}08`,
                    boxShadow:  `0 0 24px ${cfg.fg}40, inset 0 0 12px ${cfg.fg}08`,
                  }}
                >
                  <Icon
                    size={28}
                    style={{ color: cfg.fg, filter: `drop-shadow(0 0 8px ${cfg.fg})` }}
                  />
                </div>
              </div>

              {/* Status text */}
              <motion.span
                className="font-mono font-bold tracking-[0.25em] uppercase select-none"
                style={{
                  color:      cfg.fg,
                  fontSize:   "clamp(1.4rem, 4vw, 2rem)",
                  textShadow: `0 0 12px ${cfg.fg}, 0 0 30px ${cfg.fg}80, 0 0 60px ${cfg.fg}40`,
                }}
                animate={
                  mode === "logout"
                    ? { x: [0, -3, 3, -2, 2, 0] }
                    : {}
                }
                transition={
                  mode === "logout"
                    ? { duration: 0.25, delay: 0.3, repeat: 2 }
                    : {}
                }
              >
                {cfg.headline}
              </motion.span>

              {/* Sub-label */}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="font-mono text-[10px] tracking-[0.3em] uppercase"
                style={{ color: cfg.fgDim }}
              >
                {mode === "login"
                  ? "Redirecting to system..."
                  : "Disconnecting from node..."}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Flash burst ───────────────────────────────────────── */}
      <AnimatePresence>
        {flashing && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: cfg.flashBg }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4, 0] }}
            transition={{ duration: 0.45, times: [0, 0.2, 0.6, 1] }}
          />
        )}
      </AnimatePresence>

      {/* ── Fade to black ─────────────────────────────────────── */}
      <AnimatePresence>
        {fadingOut && (
          <motion.div
            className="absolute inset-0 bg-black pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
