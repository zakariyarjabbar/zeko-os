// components/system/AccessRevokedOverlay.tsx
// Shown when the current user's permissions are revoked while they have a window open.
// Detects changes via the "zk:flags:updated" window event dispatched by ShellPrefetcher.
// If the user is on a page they can no longer access, auto-redirects after a countdown.

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname }       from "next/navigation";
import { useProfile }                   from "@/components/system/SessionContext";
import { type Permission }              from "@/lib/types/permission";
import { cn }                           from "@/lib/utils";
import { ShieldOff, Lock, AlertTriangle } from "lucide-react";
import { isFounder, canViewInbox, canViewUsers } from "@/lib/permissions";

const COUNTDOWN_S = 5;

function pageIsNowForbidden(pathname: string, flags: readonly Permission[]): boolean {
  if (pathname.startsWith("/system/roles")) return !isFounder(flags);
  if (pathname.startsWith("/system/users")) return !canViewUsers(flags);
  if (pathname.startsWith("/system/inbox")) return !canViewInbox(flags);
  return false;
}

function humanizeFlag(f: string): string {
  const labels: Record<string, string> = {
    "Administrator": "System Administrator",
    "admin":         "Admin Access",
    "moderator":     "Moderator",
    "inbox-manager": "Inbox Manager",
    "view-inbox":    "Inbox Viewer",
  };
  if (labels[f]) return labels[f];
  const [action, channel] = f.split(":");
  if (channel) return `${action.replace(/-/g, " ")} → #${channel}`;
  return f;
}

interface RevokeState {
  revoked:        string[];
  shouldRedirect: boolean;
}

export function AccessRevokedOverlay() {
  const profile      = useProfile();
  const router       = useRouter();
  const pathname     = usePathname();

  const [revokeState, setRevokeState] = useState<RevokeState | null>(null);
  const [timeLeft,    setTimeLeft]    = useState(COUNTDOWN_S);
  const [progress,    setProgress]    = useState(100);

  const prevFlagsRef      = useRef<Permission[]>(profile.accessFlags);
  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef      = useRef<number>(0);
  const pathnameRef       = useRef(pathname);
  const shouldRedirectRef = useRef(false);

  // Keep refs in sync without re-registering listeners
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // Update prevFlagsRef AFTER the context re-renders with new flags.
  // This means onFlagsUpdated below always reads the flags from BEFORE the change.
  useEffect(() => { prevFlagsRef.current = profile.accessFlags; }, [profile.accessFlags]);

  // ── Detect flag removals ────────────────────────────────────────────────────
  useEffect(() => {
    function onFlagsUpdated(e: Event) {
      const newFlags = (e as CustomEvent<Permission[]>).detail;
      const oldFlags = prevFlagsRef.current;

      const newSet  = new Set(newFlags as string[]);
      const revoked = (oldFlags as string[]).filter((f) => !newSet.has(f));
      if (revoked.length === 0) return; // only grants — nothing to show

      const shouldRedirect = pageIsNowForbidden(pathnameRef.current, newFlags);
      shouldRedirectRef.current = shouldRedirect;

      setRevokeState({ revoked, shouldRedirect });
      setTimeLeft(COUNTDOWN_S);
      setProgress(100);
      startTimeRef.current = Date.now();
    }

    window.addEventListener("zk:flags:updated", onFlagsUpdated);
    return () => window.removeEventListener("zk:flags:updated", onFlagsUpdated);
  }, []);

  // ── Countdown & redirect ────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!revokeState) return;

    intervalRef.current = setInterval(() => {
      const elapsed   = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, COUNTDOWN_S - elapsed);

      setTimeLeft(Math.ceil(remaining));
      setProgress((remaining / COUNTDOWN_S) * 100);

      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        if (shouldRedirectRef.current) router.push("/system/overview");
        setRevokeState(null);
      }
    }, 50);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [revokeState, router]);

  if (!revokeState) return null;

  return (
    <>
      {/* ── Keyframes ───────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes zk-revoke-entry {
          0%   { opacity: 0; transform: scale(0.93) translateY(-14px); }
          65%  { opacity: 1; transform: scale(1.015) translateY(2px); }
          100% { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes zk-border-pulse {
          0%,100% { box-shadow: 0 0 0 1px rgba(239,68,68,.35), 0 0 28px rgba(239,68,68,.10); }
          50%     { box-shadow: 0 0 0 1px rgba(239,68,68,.75), 0 0 52px rgba(239,68,68,.22); }
        }
        @keyframes zk-glitch {
          0%,82%,100% { transform: translateX(0) skewX(0deg); opacity: 1; }
          83%  { transform: translateX(-6px) skewX(-4deg); opacity: .80; }
          85%  { transform: translateX( 6px) skewX( 3deg); opacity: .90; }
          87%  { transform: translateX(-3px) skewX(-1deg); opacity: .95; }
          89%  { transform: translateX( 3px);              opacity: 1;   }
          91%  { transform: translateX(0);                               }
        }
        @keyframes zk-scanline {
          from { background-position: 0 0;   }
          to   { background-position: 0 8px; }
        }
        @keyframes zk-blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0; }
        }
        @keyframes zk-flash {
          0%   { opacity: .22; }
          100% { opacity: 0;   }
        }
        @keyframes zk-stripe-march {
          from { background-position: 0 0; }
          to   { background-position: 28px 0; }
        }

        .zk-revoke-card {
          animation:
            zk-revoke-entry  .38s cubic-bezier(.22,1,.36,1) forwards,
            zk-border-pulse  2.6s ease-in-out .38s infinite;
        }
        .zk-revoke-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            transparent          0px,
            transparent          3px,
            rgba(0,0,0,.06)      3px,
            rgba(0,0,0,.06)      4px
          );
          background-size: 100% 4px;
          animation: zk-scanline .7s steps(1) infinite;
        }
        .zk-glitch-text { animation: zk-glitch 4.5s ease-in-out 1s infinite; }
        .zk-blink       { animation: zk-blink  1.0s step-end      infinite; }
        .zk-flash       { animation: zk-flash   .45s ease-out     forwards; }
        .zk-stripe-march {
          background: repeating-linear-gradient(
            -55deg,
            transparent           0px,
            transparent           6px,
            rgba(239,68,68,.07)   6px,
            rgba(239,68,68,.07)   14px
          );
          background-size: 28px 28px;
          animation: zk-stripe-march 1.2s linear infinite;
        }
      `}</style>

      {/* ── Screen flash on entry ────────────────────────────────────────────── */}
      <div className="zk-flash fixed inset-0 z-[9998] pointer-events-none bg-red-600/30" />

      {/* ── Backdrop ─────────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,.58)", backdropFilter: "blur(3px)" }}
      >
        {/* ── Card ─────────────────────────────────────────────────────────── */}
        <div className={cn(
          "zk-revoke-card relative w-full max-w-sm overflow-hidden",
          "rounded-xl border border-red-500/40",
          "bg-[rgba(7,10,7,.98)]",
        )}>

          {/* Marching-stripe top bar */}
          <div className="zk-stripe-march h-1 w-full" />

          {/* Alert header strip */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-500/18 bg-red-500/6">
            <AlertTriangle size={11} className="text-red-400 shrink-0 zk-blink" />
            <span className="font-mono text-[10px] text-red-400/75 uppercase tracking-[.24em]">
              Security Alert
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="font-mono text-[9px] text-red-500/50 uppercase tracking-wider">Live</span>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 zk-blink" />
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6">

            {/* Icon + heading */}
            <div className="flex items-center gap-4 mb-5">
              <div className={cn(
                "shrink-0 w-11 h-11 rounded-lg flex items-center justify-center",
                "bg-red-500/8 border border-red-500/28",
              )}>
                <ShieldOff size={20} className="text-red-400" />
              </div>
              <div>
                <p className="font-mono text-[9px] text-red-500/45 uppercase tracking-[.32em] mb-0.5">
                  Authorization Terminated
                </p>
                <h2 className="zk-glitch-text font-mono text-[1.35rem] font-bold text-red-400 leading-none tracking-tight">
                  ACCESS REVOKED
                </h2>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-red-500/12" />
              <Lock size={8} className="text-red-500/28 shrink-0" />
              <div className="flex-1 h-px bg-red-500/12" />
            </div>

            {/* Revoked list */}
            <div className="mb-5">
              <p className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest mb-2">
                Clearances Removed
              </p>
              <div className="flex flex-col gap-1">
                {revokeState.revoked.map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/5 border border-red-500/12"
                  >
                    <Lock size={9} className="text-red-500/45 shrink-0" />
                    <span className="font-mono text-sm text-red-300/70">
                      {humanizeFlag(f)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status message + countdown bar */}
            <div className="space-y-2">
              <p className="font-sans text-xs text-zinc-600 leading-relaxed">
                {revokeState.shouldRedirect ? (
                  <>
                    Access to this section has been terminated.{" "}
                    <span className="font-mono text-red-400/65">
                      Redirecting in {timeLeft}s…
                    </span>
                  </>
                ) : (
                  <>
                    Your clearance level was updated by an administrator.{" "}
                    <span className="font-mono text-zinc-500">
                      Dismissing in {timeLeft}s
                    </span>
                  </>
                )}
              </p>

              {/* Depleting progress bar */}
              <div className="h-[3px] w-full rounded-full overflow-hidden bg-red-500/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width:      `${progress}%`,
                    background: revokeState.shouldRedirect
                      ? "linear-gradient(90deg, rgba(239,68,68,.4), rgba(239,68,68,.75))"
                      : "rgba(100,100,100,.45)",
                    transition: "width 50ms linear",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Marching-stripe bottom bar */}
          <div className="zk-stripe-march h-1 w-full" style={{ animationDirection: "reverse" }} />
        </div>
      </div>
    </>
  );
}
