// components/system/ProfileDrawer.tsx
// Slide-out identity matrix drawer from the right edge.
// Framer Motion: slides in from x:100% with a backdrop overlay.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, LogOut, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { type UserProfile } from "@/lib/profile";

interface ProfileDrawerProps {
  open:     boolean;
  profile:  UserProfile;
  onClose:  () => void;
}

// ─── Live session uptime ──────────────────────────────────────
function useUptime(startMs: number) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - startMs) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Data row ─────────────────────────────────────────────────
function DataRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-zk-border/40 last:border-0">
      <span className="font-mono text-[10px] text-zk-muted/60 tracking-widest uppercase shrink-0">
        {label}
      </span>
      <span className={cn(
        "font-mono text-[11px] text-right break-all",
        accent ? "text-zk-green" : "text-zk-slate"
      )}>
        {value}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export function ProfileDrawer({ open, profile, onClose }: ProfileDrawerProps) {
  const router     = useRouter();
  const uptime     = useUptime(profile.sessionStart);
  const [terminating, setTerminating] = useState(false);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function handleTerminate() {
    setTerminating(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const initial = profile.name.charAt(0).toUpperCase();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ──────────────────────────────────── */}
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

          {/* ── Drawer ────────────────────────────────────── */}
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
              "shadow-[-8px_0_40px_rgba(0,0,0,0.7)]",
            )}
          >
            {/* ── Header ──────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zk-border shrink-0">
              <div className="flex items-center gap-2">
                <Terminal size={13} className="text-zk-green" />
                <span className="font-mono text-[11px] font-semibold text-zk-green tracking-[0.15em] uppercase">
                  Identity Matrix
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

            {/* ── Scrollable body ──────────────────────────── */}
            <div className="flex-1 overflow-y-auto">

              {/* Avatar block */}
              <div className="flex flex-col items-center gap-3 px-5 py-8 border-b border-zk-border/50">
                {/* Glowing initial box */}
                <div className={cn(
                  "w-16 h-16 rounded-sm flex items-center justify-center",
                  "border border-zk-green/40 bg-zk-green/8",
                  "shadow-[0_0_24px_rgba(0,255,65,0.2),inset_0_0_12px_rgba(0,255,65,0.05)]",
                )}>
                  <span className="font-mono text-2xl font-bold text-zk-green text-glow select-none">
                    {initial}
                  </span>
                </div>

                {/* Name + alias */}
                <div className="text-center space-y-0.5">
                  <div className="font-mono text-sm font-semibold text-zk-white tracking-wide">
                    {profile.name}
                  </div>
                  <div className="font-mono text-[11px] text-zk-green/70">
                    @{profile.alias}
                  </div>
                </div>

                {/* Clearance badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-sm border border-zk-green/20 bg-zk-green/5">
                  <ShieldCheck size={11} className="text-zk-green" />
                  <span className="font-mono text-[9px] text-zk-green tracking-widest">
                    {profile.clearanceLevel}
                  </span>
                </div>
              </div>

              {/* Data rows */}
              <div className="px-5 py-4 border-b border-zk-border/50 space-y-0">
                <div className="font-mono text-[9px] text-zk-muted/40 tracking-[0.2em] uppercase mb-3">
                  // Session Data
                </div>
                <DataRow label="UID"      value={profile.id}             accent />
                <DataRow label="Email"    value={profile.email}                  />
                <DataRow label="Role"     value={profile.role}           accent />
                <DataRow label="Dept"     value={profile.department}             />
                <DataRow label="Node"     value={profile.nodeAssignment} accent />
                <DataRow label="Uptime"   value={uptime}                 accent />
              </div>

              {/* Access flags */}
              <div className="px-5 py-4">
                <div className="font-mono text-[9px] text-zk-muted/40 tracking-[0.2em] uppercase mb-3">
                  // Access Flags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.accessFlags.map((flag) => (
                    <span
                      key={flag}
                      className="font-mono text-[9px] text-zk-green border border-zk-green/20 bg-zk-green/5 rounded-sm px-2 py-0.5 tracking-widest"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Footer: terminate session ─────────────────── */}
            <div className="shrink-0 px-5 py-4 border-t border-zk-border">
              <button
                onClick={handleTerminate}
                disabled={terminating}
                className={cn(
                  "w-full flex items-center justify-center gap-2",
                  "font-mono text-xs tracking-wider",
                  "h-9 rounded-sm border transition-all duration-150",
                  "border-zk-red/30 bg-zk-red/5 text-zk-red",
                  "hover:bg-zk-red/15 hover:border-zk-red/60",
                  "disabled:opacity-40 disabled:pointer-events-none"
                )}
              >
                {terminating
                  ? <span className="w-3 h-3 border border-zk-red border-t-transparent rounded-full animate-spin" />
                  : <LogOut size={13} />
                }
                {terminating ? "Terminating..." : "Terminate Session"}
              </button>
              <p className="mt-2 font-mono text-[9px] text-zk-muted/30 text-center tracking-widest">
                SESSION · AES-256 · E2E ENCRYPTED
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
