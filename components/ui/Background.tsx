// components/ui/Background.tsx
// Full-screen interactive canvas background.
//
// Draw order (back → front):
//   1.  Scanline sweep  — slow horizontal glow band every 14s
//   2.  Aurora bands    — 3 sinusoidal drifting light waves (green + cyan)
//   3.  Matrix rain     — ultra-faint falling terminal characters
//   4.  Edge mesh       — lines between nearby nodes, brightened by cursor
//   5.  Lightning arcs  — jagged sparks between connected nodes (rare)
//   6.  Data packets    — glowing dots on edges with tails
//   7.  Particle nodes  — drifting dots, cursor-attracted/repelled
//   8.  Meteors         — bright streaks crossing the screen
//   9.  Hex pulses      — expanding hexagon shockwaves from random points
//  10.  Click ripples   — expanding ring on click
//
// Interactivity:
//   Mouse 82–240px → gentle attraction
//   Mouse  0– 82px → repulsion bubble
//   Cursor proximity brightens nearby edges and nodes
//   Click → ripple ring at cursor

"use client";

import { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────
interface Node {
  x: number; y: number;
  vx: number; vy: number;
  r: number; baseAlpha: number;
  phase: number; isCyan: boolean;
}
interface Packet {
  fi: number; ti: number;
  p: number; speed: number;
  isCyan: boolean;
  trail: { x: number; y: number }[];
}
interface Ripple   { x: number; y: number; r: number; alpha: number; }
interface MatChar  { x: number; y: number; char: string; speed: number; alpha: number; }
interface AuroraBand {
  baseYFrac: number;   // 0–1 fraction of screen height
  amplitude: number;   // wave height in px
  k: number;           // wave number (rad/px)
  phase0: number;      // initial phase offset
  phaseSpeed: number;  // rad/s
  spread: number;      // vertical half-width of the band
  alpha: number;
  isCyan: boolean;
}
interface Meteor {
  x: number; y: number;
  vx: number; vy: number;
  tailLen: number;
  alpha: number;
  width: number;
  isCyan: boolean;
}
interface Arc {
  x1: number; y1: number;
  x2: number; y2: number;
  life: number;   // 1 → 0
  decay: number;  // per frame
  isCyan: boolean;
}
interface HexPulse {
  x: number; y: number;
  r: number; alpha: number;
  rot: number;
}

// ─── Helpers ──────────────────────────────────────────────────────
const TAU      = Math.PI * 2;
const CHARS    = "01アイウエカキクケ!@#><[]{}|/\\-_+*=?ABCDEFabcdef";
const rndChar  = () => CHARS[Math.floor(Math.random() * CHARS.length)];

/** Jagged zigzag path between two points — recomputed each frame for shimmer. */
function zigzag(x1: number, y1: number, x2: number, y2: number, segs = 5, jitter = 13) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len, py = dx / len; // perpendicular unit
  const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
  for (let i = 1; i < segs; i++) {
    const t   = i / segs;
    const off = (Math.random() - 0.5) * jitter * 2;
    pts.push({ x: x1 + dx * t + px * off, y: y1 + dy * t + py * off });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

/** Draw a regular hexagon centered at (cx,cy) with circumradius r, rotated by rot. */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rot;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ─── Component ───────────────────────────────────────────────────
export function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── State ──────────────────────────────────────────────────
    const S = {
      mx: -9999, my: -9999,
      nodes:      [] as Node[],
      packets:    [] as Packet[],
      ripples:    [] as Ripple[],
      matrixChars:[] as MatChar[],
      aurora:     [] as AuroraBand[],
      meteors:    [] as Meteor[],
      arcs:       [] as Arc[],
      hexPulses:  [] as HexPulse[],
      sweepY:     -120,
      sweepActive:false,
      raf: 0,
    };

    // ── Init / resize ──────────────────────────────────────────
    function init() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
      const W = canvas!.width, H = canvas!.height;

      // Particle nodes
      const count = Math.max(60, Math.min(130, Math.floor(W * H / 10500)));
      S.nodes = Array.from({ length: count }, () => ({
        x:         Math.random() * W,
        y:         Math.random() * H,
        vx:        (Math.random() - 0.5) * 0.28,
        vy:        (Math.random() - 0.5) * 0.28,
        r:         Math.random() * 1.7 + 0.55,
        baseAlpha: Math.random() * 0.32 + 0.10,
        phase:     Math.random() * TAU,
        isCyan:    Math.random() < 0.12,
      }));

      // Matrix chars — spaced every ~20px, clearly visible
      const cols = Math.floor(W / 20);
      S.matrixChars = Array.from({ length: cols }, (_, i) => ({
        x:     (i / cols) * W + Math.random() * 16 - 8,
        y:     Math.random() * H,
        char:  rndChar(),
        speed: Math.random() * 0.7 + 0.25,
        alpha: Math.random() * 0.09 + 0.055,
      }));

      // Aurora bands — initialised once, reused across resizes
      if (S.aurora.length === 0) {
        S.aurora = [
          { baseYFrac: 0.18, amplitude: 28, k: 0.0038, phase0: 0,              phaseSpeed: 0.19, spread: 62, alpha: 0.022, isCyan: false },
          { baseYFrac: 0.51, amplitude: 40, k: 0.0027, phase0: Math.PI * 0.7,  phaseSpeed: 0.13, spread: 80, alpha: 0.015, isCyan: true  },
          { baseYFrac: 0.80, amplitude: 22, k: 0.0051, phase0: Math.PI * 1.4,  phaseSpeed: 0.24, spread: 52, alpha: 0.019, isCyan: false },
        ];
      }
    }
    init();

    // ── Event listeners ────────────────────────────────────────
    const onResize   = () => init();
    const onMove     = (e: MouseEvent) => { S.mx = e.clientX; S.my = e.clientY; };
    const onTouch    = (e: TouchEvent) => {
      if (e.touches[0]) { S.mx = e.touches[0].clientX; S.my = e.touches[0].clientY; }
    };
    const onLeave    = () => { S.mx = -9999; S.my = -9999; };
    const onClick    = (e: MouseEvent) => {
      S.ripples.push({ x: e.clientX, y: e.clientY, r: 6, alpha: 0.60 });
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) S.ripples.push({ x: t.clientX, y: t.clientY, r: 6, alpha: 0.60 });
    };

    window.addEventListener("resize",     onResize);
    window.addEventListener("mousemove",  onMove);
    window.addEventListener("touchmove",  onTouch,    { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("click",      onClick);
    window.addEventListener("touchend",   onTouchEnd, { passive: true });

    // ── Packet spawner ─────────────────────────────────────────
    const MAX_D    = 158;
    const pktTimer = setInterval(() => {
      if (S.packets.length >= 90) return;
      const { nodes } = S;
      if (nodes.length < 2) return;
      const a = Math.floor(Math.random() * nodes.length);
      const b = Math.floor(Math.random() * nodes.length);
      if (a === b) return;
      if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) < MAX_D) {
        S.packets.push({ fi: a, ti: b, p: 0,
          speed:  0.006 + Math.random() * 0.011,
          isCyan: Math.random() < 0.28,
          trail:  [] });
      }
    }, 170);

    // ── Lightning arc spawner ──────────────────────────────────
    const arcTimer = setInterval(() => {
      if (S.arcs.length >= 4) return;
      const { nodes } = S;
      if (nodes.length < 2) return;
      const a = Math.floor(Math.random() * nodes.length);
      const b = Math.floor(Math.random() * nodes.length);
      if (a === b) return;
      if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) < MAX_D) {
        S.arcs.push({
          x1: nodes[a].x, y1: nodes[a].y,
          x2: nodes[b].x, y2: nodes[b].y,
          life: 1.0,
          decay: 0.09 + Math.random() * 0.06,
          isCyan: Math.random() < 0.45,
        });
      }
    }, 2200);

    // ── Hex pulse spawner ──────────────────────────────────────
    const hexTimer = setInterval(() => {
      const W = canvas!.width, H = canvas!.height;
      S.hexPulses.push({
        x:   W * 0.1 + Math.random() * W * 0.8,
        y:   H * 0.1 + Math.random() * H * 0.8,
        r:   14,
        alpha: 0.38,
        rot: Math.random() * (Math.PI / 3),
      });
    }, 6500);

    // ── Meteor spawner ─────────────────────────────────────────
    function spawnMeteor() {
      const W = canvas!.width, H = canvas!.height;
      const edge  = Math.floor(Math.random() * 3); // 0=top, 1=left, 2=right
      const speed = 9 + Math.random() * 7;
      let x: number, y: number, vx: number, vy: number;

      if (edge === 0) {       // top → downward
        x = Math.random() * W; y = -20;
        vx = (Math.random() - 0.5) * 4; vy = speed;
      } else if (edge === 1) { // left → rightward
        x = -20; y = Math.random() * H;
        vx = speed; vy = (Math.random() - 0.5) * 4;
      } else {                 // right → leftward
        x = W + 20; y = Math.random() * H;
        vx = -speed; vy = (Math.random() - 0.5) * 4;
      }

      S.meteors.push({
        x, y, vx, vy,
        tailLen: 90 + Math.random() * 90,
        alpha:   0.45 + Math.random() * 0.35,
        width:   1.0 + Math.random() * 1.5,
        isCyan:  Math.random() < 0.35,
      });
    }
    const meteorTimer = setInterval(spawnMeteor, 5500);
    const meteorFirst = setTimeout(spawnMeteor, 3500);

    // ── Scanline sweep scheduler ───────────────────────────────
    const triggerSweep = () => { S.sweepY = -120; S.sweepActive = true; };
    const sweepFirst   = setTimeout(triggerSweep, 2500);
    const sweepRepeat  = setInterval(triggerSweep, 14000);

    // ── Main render loop ───────────────────────────────────────
    function frame(ts: number) {
      S.raf = requestAnimationFrame(frame);
      const { nodes, packets, ripples, matrixChars, aurora, meteors, arcs, hexPulses } = S;
      const W = canvas!.width, H = canvas!.height;
      const t = ts * 0.001;

      ctx!.clearRect(0, 0, W, H);

      // ── 1. Scanline sweep ─────────────────────────────────
      if (S.sweepActive) {
        const g = ctx!.createLinearGradient(0, S.sweepY - 90, 0, S.sweepY + 90);
        g.addColorStop(0,   "rgba(0,255,65,0)");
        g.addColorStop(0.4, "rgba(0,255,65,0.018)");
        g.addColorStop(0.5, "rgba(0,255,65,0.042)");
        g.addColorStop(0.6, "rgba(0,255,65,0.018)");
        g.addColorStop(1,   "rgba(0,255,65,0)");
        ctx!.fillStyle = g;
        ctx!.fillRect(0, S.sweepY - 90, W, 180);
        S.sweepY += 1.6;
        if (S.sweepY > H + 120) S.sweepActive = false;
      }

      // ── 2. Aurora bands ───────────────────────────────────
      for (const band of aurora) {
        const phase = band.phase0 + t * band.phaseSpeed;
        const baseY = band.baseYFrac * H;
        const steps = 70;
        const [r, g, b] = band.isCyan ? [0, 212, 255] : [0, 255, 65];

        // Build the sine path once, stroke 3× at decreasing widths
        ctx!.beginPath();
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * W;
          const y = baseY + band.amplitude * Math.sin(x * band.k + phase);
          i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }

        // Wide soft outer glow
        ctx!.lineWidth   = band.spread * 2.2;
        ctx!.strokeStyle = `rgba(${r},${g},${b},${band.alpha * 0.28})`;
        ctx!.stroke();

        // Mid band
        ctx!.lineWidth   = band.spread;
        ctx!.strokeStyle = `rgba(${r},${g},${b},${band.alpha * 0.60})`;
        ctx!.stroke();

        // Bright core line
        ctx!.lineWidth   = 1.5;
        ctx!.strokeStyle = `rgba(${r},${g},${b},${band.alpha * 1.8})`;
        ctx!.stroke();
      }

      // ── 3. Matrix character rain ──────────────────────────
      // Set font once per frame — not inside the loop (saves repeated ctx state changes)
      ctx!.font        = '14px "JetBrains Mono", monospace';
      ctx!.textBaseline = "top";
      for (const c of matrixChars) {
        // Occasionally swap char and briefly flash brighter
        if (Math.random() < 0.002) {
          c.char  = rndChar();
          c.alpha = Math.random() * 0.09 + 0.055;
        }
        // Leading char slightly brighter
        const leadBoost = Math.random() < 0.004 ? 0.12 : 0;
        ctx!.fillStyle = `rgba(0,255,65,${Math.min(c.alpha + leadBoost, 0.22)})`;
        ctx!.fillText(c.char, c.x, c.y);
        c.y += c.speed;
        if (c.y > H + 18) { c.y = -18; c.x = Math.random() * W; c.char = rndChar(); }
      }

      // ── 4. Update + draw edge mesh ────────────────────────
      for (const n of nodes) {
        const dx = n.x - S.mx, dy = n.y - S.my;
        const md = Math.sqrt(dx * dx + dy * dy);
        if (md > 0 && md < 240) {
          if (md > 82) { n.vx -= (dx / md) * 0.014; n.vy -= (dy / md) * 0.014; }
          else         { const f = ((82 - md) / 82) * 0.42; n.vx += (dx / md) * f; n.vy += (dy / md) * f; }
        }
        n.vx *= 0.974; n.vy *= 0.974;
        n.vx  = Math.max(-0.85, Math.min(0.85, n.vx));
        n.vy  = Math.max(-0.85, Math.min(0.85, n.vy));
        n.x  += n.vx; n.y += n.vy;
        if (n.x < 0) { n.x = 0; n.vx =  Math.abs(n.vx); }
        if (n.x > W) { n.x = W; n.vx = -Math.abs(n.vx); }
        if (n.y < 0) { n.y = 0; n.vy =  Math.abs(n.vy); }
        if (n.y > H) { n.y = H; n.vy = -Math.abs(n.vy); }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const ex = nodes[i].x - nodes[j].x, ey = nodes[i].y - nodes[j].y;
          const d  = Math.sqrt(ex * ex + ey * ey);
          if (d >= MAX_D) continue;
          const base  = (1 - d / MAX_D) * 0.075;
          const midX  = (nodes[i].x + nodes[j].x) * 0.5;
          const midY  = (nodes[i].y + nodes[j].y) * 0.5;
          const cd    = Math.hypot(midX - S.mx, midY - S.my);
          const boost = cd < 145 ? (1 - cd / 145) * 0.13 : 0;
          ctx!.beginPath();
          ctx!.moveTo(nodes[i].x, nodes[i].y);
          ctx!.lineTo(nodes[j].x, nodes[j].y);
          ctx!.strokeStyle = `rgba(0,255,65,${base + boost})`;
          ctx!.lineWidth   = 0.5;
          ctx!.stroke();
        }
      }

      // ── 5. Lightning arcs ─────────────────────────────────
      S.arcs = arcs.filter(arc => {
        const pts = zigzag(arc.x1, arc.y1, arc.x2, arc.y2, 6, 14);
        const [r, g, b] = arc.isCyan ? [0, 212, 255] : [160, 255, 180];

        // Glow pass
        ctx!.beginPath();
        ctx!.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx!.lineTo(pts[i].x, pts[i].y);
        ctx!.strokeStyle = `rgba(${r},${g},${b},${arc.life * 0.22})`;
        ctx!.lineWidth   = arc.life * 6;
        ctx!.stroke();

        // Bright core
        ctx!.strokeStyle = `rgba(${r},${g},${b},${arc.life * 0.85})`;
        ctx!.lineWidth   = arc.life * 1.4;
        ctx!.stroke();

        // Endpoint flash dots
        for (const pt of [pts[0], pts[pts.length - 1]]) {
          const fl = ctx!.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, arc.life * 8);
          fl.addColorStop(0, `rgba(${r},${g},${b},${arc.life * 0.7})`);
          fl.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx!.beginPath(); ctx!.arc(pt.x, pt.y, arc.life * 8, 0, TAU);
          ctx!.fillStyle = fl; ctx!.fill();
        }

        arc.life -= arc.decay;
        return arc.life > 0;
      });

      // ── 6. Data packets ───────────────────────────────────
      S.packets = packets.filter(pkt => {
        const fn = nodes[pkt.fi], tn = nodes[pkt.ti];
        if (!fn || !tn || Math.hypot(fn.x - tn.x, fn.y - tn.y) > MAX_D) return false;
        const px = fn.x + (tn.x - fn.x) * pkt.p;
        const py = fn.y + (tn.y - fn.y) * pkt.p;
        pkt.trail.push({ x: px, y: py });
        if (pkt.trail.length > 6) pkt.trail.shift();
        const [r, g, b] = pkt.isCyan ? [0, 212, 255] : [0, 255, 65];
        for (let i = 0; i < pkt.trail.length; i++) {
          ctx!.beginPath();
          ctx!.arc(pkt.trail[i].x, pkt.trail[i].y, 1.1, 0, TAU);
          ctx!.fillStyle = `rgba(${r},${g},${b},${(i / pkt.trail.length) * 0.45})`;
          ctx!.fill();
        }
        const gl = ctx!.createRadialGradient(px, py, 0, px, py, 6);
        gl.addColorStop(0, `rgba(${r},${g},${b},0.88)`);
        gl.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.beginPath(); ctx!.arc(px, py, 6, 0, TAU); ctx!.fillStyle = gl; ctx!.fill();
        ctx!.beginPath(); ctx!.arc(px, py, 1.6, 0, TAU);
        ctx!.fillStyle = `rgba(${r},${g},${b},0.95)`; ctx!.fill();
        pkt.p += pkt.speed;
        return pkt.p < 1;
      });

      // ── 7. Particle nodes ─────────────────────────────────
      for (const n of nodes) {
        const pulse    = Math.sin(t * 2.1 + n.phase) * 0.18 + 0.82;
        const cd       = Math.hypot(n.x - S.mx, n.y - S.my);
        const proxGlow = cd < 115 ? (1 - cd / 115) * 0.55 : 0;
        const a        = Math.min((n.baseAlpha + proxGlow) * pulse, 0.92);
        const [r, g, b] = n.isCyan ? [0, 212, 255] : [0, 255, 65];

        const grd = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5.5);
        grd.addColorStop(0, `rgba(${r},${g},${b},${a * 0.55})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r * 5.5, 0, TAU);
        ctx!.fillStyle = grd; ctx!.fill();

        ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r, 0, TAU);
        ctx!.fillStyle = `rgba(${r},${g},${b},${Math.min(a * 1.7, 0.95)})`;
        ctx!.fill();
      }

      // ── 8. Meteors ────────────────────────────────────────
      S.meteors = meteors.filter(m => {
        m.x += m.vx; m.y += m.vy;
        if (m.x < -200 || m.x > W + 200 || m.y < -200 || m.y > H + 200) return false;

        const speed  = Math.hypot(m.vx, m.vy);
        const tailX  = m.x - (m.vx / speed) * m.tailLen;
        const tailY  = m.y - (m.vy / speed) * m.tailLen;
        const [r, g, b] = m.isCyan ? [0, 212, 255] : [0, 255, 65];

        // Tail gradient
        const tg = ctx!.createLinearGradient(m.x, m.y, tailX, tailY);
        tg.addColorStop(0, `rgba(${r},${g},${b},${m.alpha})`);
        tg.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.beginPath(); ctx!.moveTo(m.x, m.y); ctx!.lineTo(tailX, tailY);
        ctx!.strokeStyle = tg; ctx!.lineWidth = m.width; ctx!.stroke();

        // Head glow
        const hg = ctx!.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.width * 4);
        hg.addColorStop(0, `rgba(${r},${g},${b},${m.alpha})`);
        hg.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.beginPath(); ctx!.arc(m.x, m.y, m.width * 4, 0, TAU);
        ctx!.fillStyle = hg; ctx!.fill();

        // Bright core dot
        ctx!.beginPath(); ctx!.arc(m.x, m.y, m.width * 0.8, 0, TAU);
        ctx!.fillStyle = `rgba(${r},${g},${b},${m.alpha})`; ctx!.fill();

        return true;
      });

      // ── 9. Hex pulses ─────────────────────────────────────
      S.hexPulses = hexPulses.filter(h => {
        // Outer hex
        hexPath(ctx!, h.x, h.y, h.r, h.rot);
        ctx!.strokeStyle = `rgba(0,255,65,${h.alpha})`;
        ctx!.lineWidth   = 1.2;
        ctx!.stroke();

        // Inner hex (slightly smaller, cyan)
        if (h.r > 40) {
          hexPath(ctx!, h.x, h.y, h.r * 0.7, h.rot + Math.PI / 6);
          ctx!.strokeStyle = `rgba(0,212,255,${h.alpha * 0.45})`;
          ctx!.lineWidth   = 0.7;
          ctx!.stroke();
        }

        // Corner glow dots on the hex vertices
        if (h.r < 80) {
          for (let i = 0; i < 6; i++) {
            const a  = (i / 6) * TAU + h.rot;
            const vx = h.x + h.r * Math.cos(a);
            const vy = h.y + h.r * Math.sin(a);
            const dg = ctx!.createRadialGradient(vx, vy, 0, vx, vy, 5);
            dg.addColorStop(0, `rgba(0,255,65,${h.alpha * 0.9})`);
            dg.addColorStop(1, "rgba(0,255,65,0)");
            ctx!.beginPath(); ctx!.arc(vx, vy, 5, 0, TAU);
            ctx!.fillStyle = dg; ctx!.fill();
          }
        }

        h.r     += 2.4;
        h.alpha -= 0.0055;
        return h.alpha > 0;
      });

      // ── 10. Click ripples ─────────────────────────────────
      S.ripples = ripples.filter(rip => {
        ctx!.beginPath(); ctx!.arc(rip.x, rip.y, rip.r, 0, TAU);
        ctx!.strokeStyle = `rgba(0,255,65,${rip.alpha})`;
        ctx!.lineWidth   = 1.3; ctx!.stroke();

        if (rip.r > 30) {
          ctx!.beginPath(); ctx!.arc(rip.x, rip.y, rip.r - 26, 0, TAU);
          ctx!.strokeStyle = `rgba(0,212,255,${rip.alpha * 0.38})`;
          ctx!.lineWidth   = 0.7; ctx!.stroke();
        }
        if (rip.r < 28) {
          const fl = ctx!.createRadialGradient(rip.x, rip.y, 0, rip.x, rip.y, 28);
          fl.addColorStop(0, `rgba(0,255,65,${rip.alpha * 0.18})`);
          fl.addColorStop(1, "rgba(0,255,65,0)");
          ctx!.fillStyle = fl;
          ctx!.fillRect(rip.x - 28, rip.y - 28, 56, 56);
        }
        rip.r += 3.8; rip.alpha -= 0.0085;
        return rip.alpha > 0;
      });
    }

    S.raf = requestAnimationFrame(frame);

    // ── Cleanup ────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(S.raf);
      clearInterval(pktTimer);
      clearInterval(arcTimer);
      clearInterval(hexTimer);
      clearInterval(meteorTimer);
      clearInterval(sweepRepeat);
      clearTimeout(sweepFirst);
      clearTimeout(meteorFirst);
      window.removeEventListener("resize",     onResize);
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("touchmove",  onTouch);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("click",      onClick);
      window.removeEventListener("touchend",   onTouchEnd);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ willChange: "transform" }}
    />
  );
}
