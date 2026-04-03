// components/system/SystemHeader.tsx
// Minimal top bar for the system shell.
// Left:  "Zeko OS" wordmark  |  Right: Alerts, Settings, Profile icons

"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { Bell, Settings, User, LogOut } from "lucide-react";
import { AlertsPanel }   from "./AlertsPanel";
import { ProfileDrawer } from "./ProfileDrawer";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildProfile } from "@/lib/profile";
import { type SessionPayload } from "@/lib/auth";

// ─── Alert data ───────────────────────────────────────────────
export type AlertSeverity = "critical" | "warn" | "info";

export interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  timestamp: string;
  message: string;
}

const INITIAL_ALERTS: SystemAlert[] = [
  { id: "a1", severity: "critical", timestamp: "08:42:11", message: "Unauthorized SSH attempt blocked at edge node." },
  { id: "a2", severity: "critical", timestamp: "08:39:05", message: "Brute-force detected on /api/auth/login — IP blacklisted." },
  { id: "a3", severity: "warn",     timestamp: "08:35:44", message: "Memory usage spike detected on Node-3 (87% utilization)." },
  { id: "a4", severity: "warn",     timestamp: "08:21:30", message: "TLS certificate expires in 14 days — renewal required." },
  { id: "a5", severity: "warn",     timestamp: "08:17:02", message: "Anomalous traffic pattern on /api/* — scanner activity suspected." },
  { id: "a6", severity: "info",     timestamp: "07:56:51", message: "Pipeline #deploy-088 completed successfully. 3 nodes updated." },
  { id: "a7", severity: "info",     timestamp: "07:00:00", message: "Nightly database backup completed. 2.4GB archived." },
  { id: "a8", severity: "info",     timestamp: "06:45:18", message: "Key rotation scheduled for 02:00 UTC. Vault references updated." },
];

// ─── Props ────────────────────────────────────────────────────
// Extend to include full session so we can build the profile client-side
interface SystemHeaderProps {
  session: SessionPayload;
}

// ─── Icon button helper ───────────────────────────────────────
function IconBtn({
  icon,
  label,
  badge,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center w-8 h-8 rounded-sm",
        "border transition-all duration-150 cursor-pointer",
        active
          ? "border-zk-green/40 bg-zk-green/10 text-zk-green"
          : "border-transparent text-zk-slate hover:text-zk-green hover:border-zk-border hover:bg-zk-green/5"
      )}
    >
      {icon}
      {badge && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-zk-green shadow-glow-sm"
        />
      )}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────
export function SystemHeader({ session }: SystemHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut]   = useState(false);
  const [alertsOpen, setAlertsOpen]   = useState(false);
  const [alerts, setAlerts]           = useState<SystemAlert[]>(INITIAL_ALERTS);
  const [profileOpen, setProfileOpen] = useState(false);

  // Build enriched profile once per session mount
  const profile = useMemo(() => buildProfile(session), [session]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <header
        className={cn(
          "h-11 flex items-center justify-between px-4 shrink-0 relative",
          "border-b border-zk-border bg-zk-surface/80 backdrop-blur-[8px]",
        )}
      >
        {/* ── Left: wordmark ────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2 group">
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full bg-zk-green shadow-glow-sm animate-pulse"
          />
          <span className="font-mono text-sm font-semibold text-zk-green tracking-wider group-hover:text-glow transition-all duration-150">
            ZEKO OS
          </span>
          <span className="hidden sm:block font-mono text-[10px] text-zk-muted/60 tracking-widest ml-2">
            / {session.name.toLowerCase()}
          </span>
        </Link>

        {/* ── Right: icon buttons ───────────────────────────── */}
        <div className="flex items-center gap-1">

          {/* Bell — owns the alerts dropdown */}
          <div className="relative">
            <IconBtn
              icon={<Bell size={15} />}
              label="Alerts"
              badge={alerts.length > 0}
              active={alertsOpen}
              onClick={() => setAlertsOpen((v) => !v)}
            />
          </div>

          <IconBtn icon={<Settings size={15} />} label="Settings" />

          {/* Profile — opens the drawer */}
          <IconBtn
            icon={<User size={15} />}
            label="Profile"
            active={profileOpen}
            onClick={() => setProfileOpen((v) => !v)}
          />

          {/* Separator */}
          <span className="w-px h-4 bg-zk-border mx-1" aria-hidden="true" />

          {/* Logout */}
          <IconBtn
            icon={
              loggingOut
                ? <span className="w-3 h-3 border border-zk-slate border-t-transparent rounded-full animate-spin" />
                : <LogOut size={15} />
            }
            label="Log out"
            onClick={handleLogout}
          />
        </div>

        {/* ── Alerts panel ──────────────────────────────────── */}
        <div className="absolute top-full right-4">
          <AlertsPanel
            open={alertsOpen}
            alerts={alerts}
            onClose={() => setAlertsOpen(false)}
            onClear={() => { setAlerts([]); setAlertsOpen(false); }}
          />
        </div>
      </header>

      {/* ── Profile drawer — rendered outside header so it covers full screen ── */}
      <ProfileDrawer
        open={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
      />
    </>
  );
}
