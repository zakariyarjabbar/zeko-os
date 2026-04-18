// components/system/ProfileDrawer.tsx
// Slide-out identity drawer — shows display ID, identity block,
// session data, and access flags.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, Terminal, Wifi, WifiOff, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { type UserProfile } from "@/lib/profile";
import { AuthTransition } from "@/components/ui/AuthTransition";

interface ProfileDrawerProps {
  open:    boolean;
  profile: UserProfile;
  onClose: () => void;
}

// ─── Live session uptime ──────────────────────────────────────
function useUptime(startMs: number) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - startMs) / 1000));
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startMs) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, [startMs]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Status indicator ─────────────────────────────────────────
const STATUS_CONFIG = {
  ONLINE:  { color: "bg-zk-green shadow-glow-sm", label: "Online",  icon: Wifi },
  AWAY:    { color: "bg-zk-amber",                label: "Away",    icon: Clock },
  OFFLINE: { color: "bg-zk-muted/40",             label: "Offline", icon: WifiOff },
} as const;

// ─── Data row ─────────────────────────────────────────────────
function DataRow({
  label,
  value,
  accent = false,
  mono = true,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-zk-border/40 last:border-0">
      <span className="font-sans text-xs text-zk-muted/50 shrink-0">
        {label}
      </span>
      <span
        className={cn(
          "text-sm text-right break-all",
          mono ? "font-mono" : "font-sans",
          accent ? "text-zk-green" : "text-zk-slate"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans text-xs font-medium text-zk-muted/50 uppercase tracking-wide mb-3">
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export function ProfileDrawer({ open, profile, onClose }: ProfileDrawerProps) {
  const router = useRouter();
  const uptime = useUptime(profile.sessionStart);
  const [terminating, setTerminating] = useState(false);

  const status     = STATUS_CONFIG[profile.sessionStatus] ?? STATUS_CONFIG.OFFLINE;
  const initial    = profile.username.charAt(0).toUpperCase();
  const lastActive = new Date(profile.lastActive).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const [logoutTransition, setLogoutTransition] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function handleTerminate() {
    setTerminating(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // Trigger cinematic logout — router.push happens inside onComplete
    setLogoutTransition(true);
  }

  return (
    <>
    {logoutTransition && (
      <AuthTransition
        mode="logout"
        onComplete={() => router.push("/login")}
      />
    )}
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={cn(
              "fixed top-0 right-0 h-screen w-80 z-[310]",
              "flex flex-col",
              "bg-[rgba(10,15,10,0.98)] backdrop-blur-[20px]",
              "border-l border-zk-border",
              "shadow-[-8px_0_40px_rgba(0,0,0,0.7)]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zk-border shrink-0">
              <div className="flex items-center gap-2">
                <Terminal size={13} className="text-zk-green" />
                <span className="font-sans text-sm font-semibold text-zk-white">
                  Profile
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close profile"
                className="text-zk-muted hover:text-zk-white transition-colors duration-150"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Avatar block ──────────────────────────── */}
              <div className="flex flex-col items-center gap-3 px-5 py-8 border-b border-zk-border/50">
                {/* Glowing initial */}
                <div className={cn(
                  "w-16 h-16 rounded flex items-center justify-center relative",
                  "border border-zk-green/30 bg-zk-green/[0.06]"
                )}>
                  <span className="font-mono text-2xl font-bold text-zk-green text-glow select-none">
                    {initial}
                  </span>
                  {/* Status dot on avatar */}
                  <span
                    className={cn(
                      "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[rgba(10,15,10,0.98)]",
                      status.color
                    )}
                    aria-hidden="true"
                  />
                </div>

                {/* Display name + username badge */}
                <div className="text-center space-y-1.5">
                  {/* Display name — primary identity */}
                  <div className="font-sans text-sm font-semibold text-zk-white">
                    {profile.displayName || profile.username}
                  </div>
                  {/* @username in green box */}
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded border border-zk-green/30 bg-zk-green/[0.08]">
                    <span className="font-mono text-xs text-zk-green">
                      @{profile.username}
                    </span>
                  </div>
                </div>


              </div>

              {/* ── Identity block ────────────────────────── */}
              <div className="px-5 py-4 border-b border-zk-border/50">
                <SectionHeader>Identity</SectionHeader>
                <DataRow label="Display ID"   value={profile.displayId > 0 ? `#${profile.displayId}` : "—"} accent />
                <DataRow label="Display Name" value={profile.displayName || "—"} />
                <DataRow label="Username"     value={profile.username}   accent />
                <DataRow label="Email"        value={profile.email}              />
                <DataRow label="Role"         value={profile.role}       accent />

              </div>

              {/* ── Session block ─────────────────────────── */}
              <div className="px-5 py-4 border-b border-zk-border/50">
                <SectionHeader>Session</SectionHeader>

                {/* Status row — special treatment */}
                <div className="flex items-center justify-between gap-4 py-2 border-b border-zk-border/40">
                  <span className="font-sans text-xs text-zk-muted/50">
                    Status
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-1.5 h-1.5 rounded-full", status.color)} />
                    <span className="font-sans text-sm text-zk-green">
                      {status.label}
                    </span>
                  </div>
                </div>

                <DataRow label="Uptime"      value={uptime}    accent />
                <DataRow label="Last Active" value={lastActive}          />
              </div>

              {/* ── Access flags ──────────────────────────── */}
              <div className="px-5 py-4">
                <SectionHeader>Access Flags</SectionHeader>
                <div className="flex flex-wrap gap-1.5">
                  {profile.accessFlags.map((flag) => (
                    <span
                      key={flag}
                      className="font-sans text-xs text-zk-green border border-zk-green/20 bg-zk-green/[0.05] rounded px-2 py-0.5"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-4 border-t border-zk-border">
              <button
                onClick={handleTerminate}
                disabled={terminating}
                className={cn(
                  "w-full flex items-center justify-center gap-2",
                  "font-sans text-sm",
                  "h-9 rounded border transition-all duration-150",
                  "border-zk-red/30 bg-zk-red/5 text-zk-red",
                  "hover:bg-zk-red/15 hover:border-zk-red/60",
                  "disabled:opacity-40 disabled:pointer-events-none"
                )}
              >
                {terminating
                  ? <span className="w-3 h-3 border border-zk-red border-t-transparent rounded-full animate-spin" />
                  : <LogOut size={13} />
                }
                {terminating ? "Signing out..." : "Sign Out"}
              </button>
              <p className="mt-2 font-sans text-xs text-zk-muted/25 text-center">
                AES-256 end-to-end encrypted
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
