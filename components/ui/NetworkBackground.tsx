// components/ui/NetworkBackground.tsx
// Full-screen canvas — animated network topology.
// Floating nodes + edges + cyan data packets + mouse repulsion.
// Exposes a handle (via bgRef) for:
//   .ripple(x, y)  → expanding ring from point
//   .burst()        → push all nodes outward from center

"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  a: number;
  phase: number;
}

interface Packet {
  fi: number; ti: number;
  p: number;
  speed: number;
}

interface Ripple {
  x: number; y: number;
  r: number;
  a: number;
}

export interface NetworkBgHandle {
  ripple(x: number, y: number): void;
  burst(): void;
}

export function NetworkBackground({
  bgRef,
}: {
  bgRef?: React.MutableRefObject<NetworkBgHandle | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const state = {
      mx: -999, my: -999,
      nodes: [] as Node[],
      packets: [] as Packet[],
      ripples: [] as Ripple[],
      burst: false,
      raf: 0,
    };

    function initNodes() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.max(50, Math.floor(canvas.width * canvas.height / 13000));
      state.nodes = Array.from({ length: count }, () => ({
        x:     Math.random() * canvas.width,
        y:     Math.random() * canvas.height,
        vx:    (Math.random() - 0.5) * 0.38,
        vy:    (Math.random() - 0.5) * 0.38,
        r:     Math.random() * 1.6 + 0.7,
        a:     Math.random() * 0.4 + 0.15,
        phase: Math.random() * Math.PI * 2,
      }));
    }
    initNodes();

    if (bgRef) {
      bgRef.current = {
        ripple: (x, y) => state.ripples.push({ x, y, r: 10, a: 0.7 }),
        burst: () => {
          state.burst = true;
          setTimeout(() => { state.burst = false; }, 500);
        },
      };
    }

    const onMM = (e: MouseEvent) => { state.mx = e.clientX; state.my = e.clientY; };
    const onTM = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) { state.mx = t.clientX; state.my = t.clientY; }
    };
    window.addEventListener("resize", initNodes);
    window.addEventListener("mousemove", onMM);
    window.addEventListener("touchmove", onTM, { passive: true });

    // Spawn data packets between nearby nodes
    const pktTimer = setInterval(() => {
      const { nodes, packets } = state;
      if (nodes.length < 2 || packets.length > 75) return;
      const a = Math.floor(Math.random() * nodes.length);
      const b = Math.floor(Math.random() * nodes.length);
      if (a === b) return;
      const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
      if (d < 165) {
        packets.push({ fi: a, ti: b, p: 0, speed: 0.006 + Math.random() * 0.011 });
      }
    }, 220);

    const MAX_D = 158;

    function frame(ts: number) {
      state.raf = requestAnimationFrame(frame);
      const { nodes, packets, ripples } = state;
      const t = ts * 0.001;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // ── Update nodes ─────────────────────────────────────────
      for (const n of nodes) {
        // Mouse repulsion
        const mdx = n.x - state.mx, mdy = n.y - state.my;
        const md = Math.hypot(mdx, mdy);
        if (md < 160 && md > 0) {
          const f = ((160 - md) / 160) * 0.52;
          n.vx += (mdx / md) * f;
          n.vy += (mdy / md) * f;
        }
        // Burst: push outward from screen center
        if (state.burst) {
          const cx = n.x - W / 2, cy = n.y - H / 2;
          const c = Math.hypot(cx, cy) || 1;
          n.vx += (cx / c) * 1.4;
          n.vy += (cy / c) * 1.4;
        }
        n.vx *= 0.97; n.vy *= 0.97;
        n.vx = Math.max(-1.1, Math.min(1.1, n.vx));
        n.vy = Math.max(-1.1, Math.min(1.1, n.vy));
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0)  { n.x = 0;  n.vx *= -1; }
        if (n.x > W)  { n.x = W;  n.vx *= -1; }
        if (n.y < 0)  { n.y = 0;  n.vy *= -1; }
        if (n.y > H)  { n.y = H;  n.vy *= -1; }
      }

      // ── Edges ────────────────────────────────────────────────
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < MAX_D) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0,255,65,${(1 - d / MAX_D) * 0.09})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // ── Data packets ─────────────────────────────────────────
      state.packets = packets.filter(pkt => {
        const fn = nodes[pkt.fi], tn = nodes[pkt.ti];
        if (!fn || !tn) return false;
        const d = Math.hypot(fn.x - tn.x, fn.y - tn.y);
        if (d > MAX_D) return false;
        const px = fn.x + (tn.x - fn.x) * pkt.p;
        const py = fn.y + (tn.y - fn.y) * pkt.p;
        // Glow halo
        const g = ctx.createRadialGradient(px, py, 0, px, py, 5);
        g.addColorStop(0, "rgba(0,212,255,0.88)");
        g.addColorStop(1, "rgba(0,212,255,0)");
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        // Core
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,212,255,0.95)"; ctx.fill();
        pkt.p += pkt.speed;
        return pkt.p < 1;
      });

      // ── Nodes ────────────────────────────────────────────────
      for (const n of nodes) {
        const pulse = Math.sin(t * 2.1 + n.phase) * 0.22 + 0.78;
        const a = n.a * pulse;
        // Glow halo
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4.5);
        g.addColorStop(0, `rgba(0,255,65,${a * 0.75})`);
        g.addColorStop(1, "rgba(0,255,65,0)");
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        // Core dot
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,65,${Math.min(a * 1.6, 0.92)})`;
        ctx.fill();
      }

      // ── Ripples ──────────────────────────────────────────────
      state.ripples = ripples.filter(rip => {
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,255,65,${rip.a})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        // Trailing second ring (cyan)
        if (rip.r > 60) {
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r - 50, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,212,255,${rip.a * 0.28})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        rip.r += 4; rip.a -= 0.011;
        return rip.a > 0;
      });
    }

    state.raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(state.raf);
      clearInterval(pktTimer);
      window.removeEventListener("resize", initNodes);
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("touchmove", onTM);
    };
  }, [bgRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
    />
  );
}
