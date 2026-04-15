// components/ui/CursorTrail.tsx
// Green particle trail that follows the mouse cursor.
// Only renders on pointer (mouse) devices — hidden on touch screens.

"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 → 0
  size: number;
}

export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Only run on fine-pointer (mouse) devices
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const c   = ctx;
    const cvs = canvas;

    const resize = () => {
      cvs.width  = window.innerWidth;
      cvs.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    let animId: number;

    const onMouseMove = (e: MouseEvent) => {
      // Spawn 2 particles per move event
      for (let i = 0; i < 2; i++) {
        particles.push({
          x:    e.clientX + (Math.random() - 0.5) * 6,
          y:    e.clientY + (Math.random() - 0.5) * 6,
          vx:   (Math.random() - 0.5) * 0.8,
          vy:   (Math.random() - 0.5) * 0.8 - 0.3, // slight upward drift
          life: 1,
          size: Math.random() * 2.5 + 1,
        });
      }
      // Hard cap to avoid memory growth
      if (particles.length > 90) particles.splice(0, particles.length - 90);
    };

    window.addEventListener("mousemove", onMouseMove);

    function draw() {
      c.clearRect(0, 0, cvs.width, cvs.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x    += p.vx;
        p.y    += p.vy;
        p.life -= 0.03;

        if (p.life <= 0) { particles.splice(i, 1); continue; }

        const alpha = p.life * 0.55;
        const r     = p.size * p.life;

        c.beginPath();
        c.arc(p.x, p.y, r, 0, Math.PI * 2);
        c.fillStyle   = `rgba(0,255,65,${alpha})`;
        c.shadowBlur  = 8;
        c.shadowColor = `rgba(0,255,65,${alpha * 0.6})`;
        c.fill();
      }

      // Reset shadow so it doesn't bleed into next frame's clearRect
      c.shadowBlur = 0;

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
      aria-hidden="true"
    />
  );
}
