// components/system/PresenceTracker.tsx
// Mounted once by SystemLayout — marks the user ONLINE on entry and
// OFFLINE on exit (tab close, browser close, or sign-out).
// Never runs on the landing/login pages.

"use client";

import { useEffect } from "react";

export function PresenceTracker() {
  useEffect(() => {
    const beat = () => fetch("/api/presence", { method: "POST" });

    // ── Mark online immediately ──────────────────────────────
    beat();

    // ── Heartbeat every 20 s ─────────────────────────────────
    // Keeps last_active fresh so the 60-second stale check never
    // incorrectly shows an active user as offline.
    const heartbeatId = setInterval(beat, 20_000);

    // ── Resume after tab is brought back to foreground ───────
    // Prevents a user returning to the tab from appearing offline
    // for up to 30 s while waiting for the next scheduled beat.
    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ── Tab / browser close ───────────────────────────────────
    // keepalive: true lets the request complete even as the page unloads.
    const onUnload = () =>
      fetch("/api/presence", { method: "DELETE", keepalive: true });
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(heartbeatId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      // Fires when the user navigates away inside the app (e.g. to /login).
      // The logout handler calls DELETE first, so this is a safety-net only.
      fetch("/api/presence", { method: "DELETE" });
    };
  }, []);

  return null;
}
