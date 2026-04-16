// components/sections/Navbar.tsx
// Minimalist top navigation bar.
// Logo: "Zeko OS" with glowing terminal cursor dot.
// Includes placeholder links for future pages.

"use client";

import { useState, useEffect } from "react";
import { Menu, X, Terminal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ─── Nav Links (placeholder — expand as pages are added) ────
const NAV_LINKS = [
  { label: "// modules",   href: "#features"  },
  { label: "// system",    href: "#showcase"  },
  { label: "// contact",   href: "#contact"   },
] as const;

// ─── Component ──────────────────────────────────────────────
export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Add glass effect after scroll — RAF-gated so it fires at most once per frame
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
        ticking = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-[rgba(5,5,5,0.92)] backdrop-blur-[16px] shadow-[0_1px_0_0_rgba(0,255,65,0.15)]"
          : "bg-transparent"
      )}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* ── Logo ─────────────────────────────────────────── */}
        <a
          href="#"
          className="flex items-center gap-2.5 group"
          aria-label="Zeko OS Home"
        >
          {/* Icon */}
          <div className="relative flex items-center justify-center w-8 h-8 rounded-sm border border-zk-green/30 bg-zk-green/8 group-hover:border-zk-green/60 group-hover:shadow-glow-sm transition-all duration-200">
            <Terminal size={14} className="text-zk-green" />
          </div>

          {/* Wordmark */}
          <span className="font-mono text-base font-semibold tracking-widest text-zk-white group-hover:text-glow transition-all duration-200">
            ZEKO
            <span className="text-zk-green text-glow-sm">_OS</span>
          </span>

          {/* Blinking cursor dot */}
          <span
            className="w-1.5 h-1.5 rounded-full bg-zk-green shadow-glow-sm animate-cursor-blink"
            aria-hidden="true"
          />
        </a>

        {/* ── Desktop Links ─────────────────────────────────── */}
        <ul className="hidden md:flex items-center gap-1" role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={cn(
                  "font-mono text-xs tracking-widest uppercase",
                  "text-zk-muted hover:text-zk-green",
                  "px-3 py-2 rounded-sm transition-colors duration-150",
                  "hover:bg-zk-green/5"
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* ── Desktop CTA ───────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/system/overview">
            <Button variant="outline" size="sm">Initialize →</Button>
          </Link>
        </div>

        {/* ── Mobile Menu Toggle ────────────────────────────── */}
        <button
          className="md:hidden text-zk-muted hover:text-zk-green transition-colors"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          aria-label={isMobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileOpen}
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* ── Mobile Menu Drawer ─────────────────────────────── */}
      {isMobileOpen && (
        <div className="md:hidden border-t border-zk-border bg-[rgba(5,5,5,0.97)] backdrop-blur-[16px] px-6 py-4">
          <ul className="flex flex-col gap-1 mb-4" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="block font-mono text-sm text-zk-muted hover:text-zk-green px-2 py-2.5 transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <Link href="/system/overview">
              <Button variant="primary" size="md" className="w-full">
                Initialize →
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
