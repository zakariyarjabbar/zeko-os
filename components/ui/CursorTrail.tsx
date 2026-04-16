// components/ui/CursorTrail.tsx
// Green particle trail that follows the mouse cursor.
// Only renders on pointer (mouse) devices — hidden on touch screens.
// Uses a fixed-size ring buffer to avoid array.splice on the hot path.

"use client";

import { useEffect, useRef } from "react";

const CAPACITY = 90;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; // 1 → 0
  size: number;
}

export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Ring buffer — no allocations on the hot path ──────────
    const buf   = new Array<Particle>(CAPACITY).fill(null as unknown as Particle);
    let   head  = 0; // next write index
    let   count = 0; // live particles

    const onMouseMove = (e: MouseEvent) => {
      for (let i = 0; i < 2; i++) {
        buf[head] = {
          x:    e.clientX + (Math.random() - 0.5) * 6,
          y:    e.clientY + (Math.random() - 0.5) * 6,
          vx:   (Math.random() - 0.5) * 0.8,
          vy:   (Math.random() - 0.5) * 0.8 - 0.3,
          life: 1,
          size: Math.random() * 2.5 + 1,
        };
        head = (head + 1) % CAPACITY;
        if (count < CAPACITY) count++;
      }
    };

    window.addEventListener("mousemove", onMouseMove);

    let animId: number;

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (let i = 0; i < CAPACITY; i++) {
        const p = buf[i];
        if (!p || p.life <= 0) continue;

        p.x    += p.vx;
        p.y    += p.vy;
        p.life -= 0.03;

        if (p.life <= 0) continue;

        const alpha = p.life * 0.55;
        const r     = p.size * p.life;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx!.fillStyle   = `rgba(0,255,65,${alpha})`;
        ctx!.shadowBlur  = 8;
        ctx!.shadowColor = `rgba(0,255,65,${alpha * 0.6})`;
        ctx!.fill();
      }

      ctx!.shadowBlur = 0;
      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ willChange: "transform" }}
      aria-hidden="true"
    />
  );
}
