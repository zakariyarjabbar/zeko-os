// components/sections/Hero.tsx
// Hero section — typing headline, sub-headline, CTA buttons,
// and a row of 4 "System Stats" with monospace numbers.

"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ─── System Stats Data ───────────────────────────────────────
const SYSTEM_STATS = [
  { label: "Deployments",    value: 142,    suffix: "" },
  { label: "Active Modules", value: 98,     suffix: "" },
  { label: "Uptime",         value: 99.97,  suffix: "%" },
  { label: "Response (ms)",  value: 12,     suffix: "ms" },
] as const;

// ─── Typing Effect Hook ──────────────────────────────────────
function useTypingEffect(fullText: string, speed = 55) {
  const [displayedText, setDisplayedText] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    let index = 0;
    setDisplayedText("");
    setIsDone(false);

    const interval = setInterval(() => {
      index++;
      setDisplayedText(fullText.slice(0, index));
      if (index >= fullText.length) {
        setIsDone(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [fullText, speed]);

  return { displayedText, isDone };
}

// ─── Animated Counter ────────────────────────────────────────
function AnimatedStat({
  value,
  suffix,
  delay,
}: {
  value: number;
  suffix: string;
  delay: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const end = value;
      const duration = 1200;
      const step = end / (duration / 16);

      const counter = setInterval(() => {
        start = Math.min(start + step, end);
        setCount(parseFloat(start.toFixed(end % 1 !== 0 ? 2 : 0)));
        if (start >= end) clearInterval(counter);
      }, 16);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  const formatted =
    value % 1 !== 0 ? count.toFixed(2) : Math.floor(count).toString();

  return (
    <span ref={ref} className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}

// ─── Component ──────────────────────────────────────────────
export function Hero() {
  const { displayedText, isDone } = useTypingEffect(
    "Initializing Zeko OS...",
    60
  );

  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden"
    >
      {/* ── Background Effects ───────────────────────────── */}
      {/* Radial green glow behind text */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-[800px] h-[500px] rounded-full bg-zk-green/[0.04] blur-[100px]" />
      </div>

      {/* Horizontal grid lines */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,65,0.04) 1px, transparent 1px)",
          backgroundSize: "100% 80px",
        }}
      />

      {/* ── Content ──────────────────────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">

        {/* Status badge */}
        <div className="animate-fade-in-up delay-100 inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-sm border border-zk-green/20 bg-zk-green/5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-zk-green animate-pulse shadow-glow-sm"
            aria-hidden="true"
          />
          <span className="font-mono text-xs text-zk-green tracking-widest uppercase">
            System Online — v1.0.0
          </span>
        </div>

        {/* Main headline with typing effect */}
        <h1 className="animate-fade-in-up delay-200 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-none mb-6">
          {/* Typed portion — monospace, green */}
          <span className="font-mono text-zk-green text-glow block">
            {displayedText}
            {/* Blinking cursor */}
            {!isDone && (
              <span
                className="inline-block w-[0.6em] h-[0.85em] bg-zk-green animate-cursor-blink align-bottom ml-1"
                aria-hidden="true"
              />
            )}
          </span>
        </h1>

        {/* Sub-headline */}
        <p
          className={cn(
            "animate-fade-in-up delay-300",
            "max-w-2xl mx-auto text-lg sm:text-xl text-zk-slate leading-relaxed mb-4",
            "transition-opacity duration-500",
            isDone ? "opacity-100" : "opacity-0"
          )}
        >
          A precision-engineered digital environment built for engineers who
          demand{" "}
          <span className="text-zk-white font-medium">
            performance, modularity,
          </span>{" "}
          and{" "}
          <span className="text-zk-green font-mono">zero compromise.</span>
        </p>

        {/* Secondary caption */}
        <p
          className={cn(
            "animate-fade-in-up delay-400",
            "font-mono text-xs text-zk-muted tracking-widest mb-12",
            "transition-opacity duration-500",
            isDone ? "opacity-100" : "opacity-0"
          )}
        >
          {">"} KERNEL_VERSION=1.0.0 &nbsp;|&nbsp; ARCH=x86_64 &nbsp;|&nbsp;
          ENV=PRODUCTION
        </p>

        {/* CTA Buttons */}
        <div
          className={cn(
            "animate-fade-in-up delay-500",
            "flex flex-wrap items-center justify-center gap-4 mb-16",
            "transition-opacity duration-500",
            isDone ? "opacity-100" : "opacity-0"
          )}
        >
          <Link href="/system/overview">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight size={16} />}
              className="min-w-[180px]"
            >
              Initialize
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            leftIcon={<Play size={14} />}
            className="min-w-[180px]"
          >
            Watch Demo
          </Button>
        </div>

        {/* ── System Stats ─────────────────────────────────── */}
        <div
          className={cn(
            "animate-fade-in-up delay-600",
            "grid grid-cols-2 sm:grid-cols-4 gap-px",
            "border border-zk-border rounded-lg overflow-hidden",
            "bg-zk-border", // gap color
            "transition-opacity duration-500",
            isDone ? "opacity-100" : "opacity-0"
          )}
        >
          {SYSTEM_STATS.map((stat, index) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center gap-1 bg-zk-bg px-6 py-5 hover:bg-zk-green/5 transition-colors duration-200 group"
            >
              {/* Number */}
              <span className="font-mono text-2xl sm:text-3xl font-bold text-zk-green text-glow-sm">
                <AnimatedStat
                  value={stat.value}
                  suffix={stat.suffix}
                  delay={800 + index * 150}
                />
              </span>
              {/* Label */}
              <span className="font-mono text-[10px] text-zk-muted tracking-widest uppercase group-hover:text-zk-slate transition-colors">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
