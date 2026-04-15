// components/system/SystemHeader.tsx
// Redesigned top bar — clock, breadcrumb, alert bell, profile.

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Bell, User, LogOut, Terminal } from "lucide-react";
import { AlertsPanel }    from "./AlertsPanel";
import { ProfileDrawer }  from "./ProfileDrawer";
import { AuthTransition } from "@/components/ui/AuthTransition";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { type UserProfile } from "@/lib/profile";
import { type SessionPayload } from "@/lib/auth";

export type AlertSeverity = "critical" | "warn" | "info";
export interface SystemAlert {
  id:        string;
  severity:  AlertSeverity;
  timestamp: string;
  message:   string;
}

const INITIAL_ALERTS: SystemAlert[] = [
  { id: "a1", severity: "critical", timestamp: "08:42:11", message: "Unauthorized SSH attempt blocked at edge node." },
  { id: "a2", severity: "critical", timestamp: "08:39:05", message: "Brute-force detected on /api/auth/login — IP blacklisted." },
  { id: "a3", severity: "warn",     timestamp: "08:35:44", message: "Memory usage spike on Node-3 (87% utilization)." },
  { id: "a4", severity: "warn",     timestamp: "08:21:30", message: "TLS certificate expires in 14 days — renewal required." },
  { id: "a5", severity: "warn",     timestamp: "08:17:02", message: "Anomalous traffic pattern on /api/* — scanner activity suspected." },
  { id: "a6", severity: "info",     timestamp: "07:56:51", message: "Pipeline #deploy-088 completed. 3 nodes updated." },
  { id: "a7", severity: "info",     timestamp: "07:00:00", message: "Nightly database backup completed. 2.4 GB archived." },
  { id: "a8", severity: "info",     timestamp: "06:45:18", message: "Key rotation scheduled for 02:00 UTC. Vault references updated." },
];

// Route → breadcrumb label
const ROUTE_LABELS: Record<string, string> = {
  "/system/overview": "Overview",
  "/system/chat":     "Comms",
  "/system/inbox":    "Inbox",
  "/system/users":    "Users",
  "/system/roles":    "Roles",
};

interface SystemHeaderProps {
  session: SessionPayload;
  profile: UserProfile;
}

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function tick() {
      setTime(new Date().toTimeString().slice(0, 8));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-[11px] text-zk-muted/50 tabular-nums select-none">
      {time}
    </span>
  );
}

function IconBtn({
  icon, label, badge, onClick, active,
}: {
  icon: React.ReactNode; label: string;
  badge?: boolean; onClick?: () => void; active?: boolean;
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
          : "border-transparent text-zk-muted/60 hover:text-zk-green hover:border-zk-border/60 hover:bg-zk-green/5"
      )}
    >
      {icon}
      {badge && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-zk-red shadow-[0_0_6px_rgba(255,59,59,0.8)]"
        />
      )}
    </button>
  );
}

export function SystemHeader({ session, profile }: SystemHeaderProps) {
  const router    = useRouter();
  const pathname  = usePathname();
  const [loggingOut,        setLoggingOut]        = useState(false);
  const [alertsOpen,        setAlertsOpen]        = useState(false);
  const [alerts,            setAlerts]            = useState<SystemAlert[]>(INITIAL_ALERTS);
  const [profileOpen,       setProfileOpen]       = useState(false);
  const [logoutTransition,  setLogoutTransition]  = useState(false);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const routeLabel    = ROUTE_LABELS[pathname] ?? "System";

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/presence", { method: "DELETE" });
    await fetch("/api/auth/logout", { method: "POST" });
    // Fire cinematic transition — router.push happens inside onComplete
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
      <header className={cn(
        "h-11 flex items-center justify-between px-5 shrink-0 relative",
        "border-b border-zk-border/60",
        "bg-[rgba(5,5,5,0.95)] backdrop-blur-[8px]",
      )}>
        {/* ── Left ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <Terminal size={13} className="text-zk-green group-hover:text-glow transition-all" />
            <span className="font-mono text-sm font-bold text-zk-green tracking-widest group-hover:text-glow transition-all">
              ZEKO OS
            </span>
          </Link>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-zk-muted/40 select-none">
            <span className="font-mono text-[10px]">/</span>
            <span className="font-mono text-[11px] text-zk-muted/60 tracking-wider">
              {routeLabel}
            </span>
          </div>
        </div>

        {/* ── Center: live clock ────────────────────────────── */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <LiveClock />
          <span className="w-px h-3 bg-zk-border/60" />
          <span className="font-mono text-[11px] text-zk-muted/40 tracking-widest select-none">
            {session.name.toLowerCase()}
          </span>
        </div>

        {/* ── Right ────────────────────────────────────────── */}
        <div className="flex items-center gap-1">
          {/* Bell */}
          <div className="relative">
            <IconBtn
              icon={<Bell size={14} />}
              label="Alerts"
              badge={criticalCount > 0}
              active={alertsOpen}
              onClick={() => setAlertsOpen((v) => !v)}
            />
          </div>

          {/* Profile */}
          <IconBtn
            icon={<User size={14} />}
            label="Profile"
            active={profileOpen}
            onClick={() => setProfileOpen((v) => !v)}
          />

          <span className="w-px h-4 bg-zk-border/60 mx-1" aria-hidden="true" />

          {/* Logout */}
          <IconBtn
            icon={loggingOut
              ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              : <LogOut size={14} />
            }
            label="Log out"
            onClick={handleLogout}
          />
        </div>

        {/* Alerts panel */}
        <div className="absolute top-full right-4">
          <AlertsPanel
            open={alertsOpen}
            alerts={alerts}
            onClose={() => setAlertsOpen(false)}
            onClear={() => { setAlerts([]); setAlertsOpen(false); }}
          />
        </div>
      </header>

      <ProfileDrawer
        open={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
      />
    </>
  );
}
