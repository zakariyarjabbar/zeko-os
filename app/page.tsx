// app/page.tsx
// Landing page — assembles all sections in order.
// Shows the BootSequence overlay on first visit; reveals content when it completes.

"use client";

import { useState, useEffect } from "react";
import { Background }         from "@/components/ui/Background";
import { BootSequence }       from "@/components/ui/BootSequence";
import { KonamiCode }         from "@/components/ui/KonamiCode";
import { SystemHint }         from "@/components/ui/SystemHint";
import { Navbar }             from "@/components/sections/Navbar";
import { Hero }               from "@/components/sections/Hero";
import { TerminalPlayground } from "@/components/sections/TerminalPlayground";
import { LiveMonitor }        from "@/components/sections/LiveMonitor";
import { Features }           from "@/components/sections/Features";
import { CodeShowcase }       from "@/components/sections/CodeShowcase";
import { Contact }            from "@/components/sections/Contact";
import { Footer }             from "@/components/sections/Footer";

export default function HomePage() {
  const [isBooting, setIsBooting] = useState(false);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    // Runs synchronously before first paint.
    // ready=false → black screen on first cycle → no landing page flash.
    const id = window.setTimeout(() => {
      if (!sessionStorage.getItem("zk_booted")) {
        setIsBooting(true);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function handleBootComplete() {
    sessionStorage.setItem("zk_booted", "1");
    setIsBooting(false);
  }

  return (
    <>
      {/* ── z-0: Full-screen interactive canvas background ── */}
      <Background />

      {/* ── z-1: Edge vignette — darkens corners/edges ────── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: [
            "radial-gradient(ellipse 90% 80% at 50% 42%, transparent 45%, rgba(5,5,5,0.55) 100%)",
            "linear-gradient(to bottom, rgba(5,5,5,0.35) 0%, transparent 8%, transparent 88%, rgba(5,5,5,0.55) 100%)",
          ].join(", "),
        }}
      />

      {/* ── Black cover on first cycle — no flash ─────────── */}
      {!ready && (
        <div className="fixed inset-0 z-[9999] bg-black" aria-hidden="true" />
      )}

      {/* ── Global interactive overlays ────────────────────── */}
      <KonamiCode />
      <SystemHint />

      {/* ── Boot overlay ───────────────────────────────────── */}
      {isBooting && <BootSequence onComplete={handleBootComplete} />}

      {/* ── All visible page content at z-[2] ─────────────── */}
      <div className="relative z-[2]">
        <Navbar />

        <main>
          <Hero />
          <TerminalPlayground />
          <LiveMonitor />
          <Features />
          <CodeShowcase />
          <Contact />
        </main>

        <Footer />
      </div>
    </>
  );
}
