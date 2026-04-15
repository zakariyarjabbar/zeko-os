// app/page.tsx
// Landing page — assembles all sections in order.
// Shows the BootSequence overlay on first visit; reveals content when it completes.

"use client";

import { useState, useLayoutEffect } from "react";
import { BootSequence }       from "@/components/ui/BootSequence";
import { CursorTrail }        from "@/components/ui/CursorTrail";
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

  useLayoutEffect(() => {
    // Runs synchronously before first paint.
    // ready=false → black screen on first cycle → no landing page flash.
    if (!sessionStorage.getItem("zk_booted")) {
      setIsBooting(true);
    }
    setReady(true);
  }, []);

  function handleBootComplete() {
    sessionStorage.setItem("zk_booted", "1");
    setIsBooting(false);
  }

  return (
    <>
      {/* Black cover on first cycle — prevents flash before useLayoutEffect runs */}
      {!ready && (
        <div className="fixed inset-0 z-[9999] bg-black" aria-hidden="true" />
      )}

      {/* Global interactive overlays */}
      <CursorTrail />
      <KonamiCode />
      <SystemHint />

      {/* Boot overlay */}
      {isBooting && <BootSequence onComplete={handleBootComplete} />}

      {/* Fixed navigation bar */}
      <Navbar />

      {/* Main content */}
      <main>
        {/* 1. Hero — headline, stats, CTAs */}
        <Hero />

        {/* 2. Interactive terminal shell */}
        <TerminalPlayground />

        {/* 3. Live system monitor — real-time metrics + process table */}
        <LiveMonitor />

        {/* 4. Features — System Modules grid */}
        <Features />

        {/* 5. Code Showcase — terminal window + value props */}
        <CodeShowcase />

        {/* 6. Contact — CLI-style form */}
        <Contact />
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}
