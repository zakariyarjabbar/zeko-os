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
import { getChatCache } from "@/lib/chat-cache";

export type AlertSeverity = "critical" | "warn" | "info";
export interface SystemAlert {
  id:        string;
  severity:  AlertSeverity;
  timestamp: string;
  message:   string;
}

function formatAlertTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toTimeString().slice(0, 8);
  } catch { /* ignore */ }
  return "";
}

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
    <span className="font-mono text-xs text-zk-muted/50 tabular-nums select-none">
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
        "relative flex items-center justify-center w-8 h-8 rounded",
        "transition-all duration-150 cursor-pointer",
        active
          ? "bg-zk-green/10 text-zk-green"
          : "text-zk-muted/60 hover:text-zk-white hover:bg-zk-surface"
      )}
    >
      {icon}
      {badge && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zk-red shadow-[0_0_6px_rgba(255,59,59,0.8)]"
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
  const [alerts,            setAlerts]            = useState<SystemAlert[]>([]);
  const [profileOpen,       setProfileOpen]       = useState(false);
  const [logoutTransition,  setLogoutTransition]  = useState(false);

  // Build alerts from unread DM conversations
  useEffect(() => {
    function buildAlerts() {
      const convos = getChatCache().getDmConvos() ?? [];
      const dmAlerts: SystemAlert[] = convos
        .filter((c) => c.unread > 0)
        .map((c) => ({
          id:        c.userId,
          severity:  "info" as AlertSeverity,
          timestamp: formatAlertTime(c.lastTime),
          message:   `New DM from @${c.handle}${c.unread > 1 ? ` (${c.unread} unread)` : ""}: ${c.lastMsg}`,
        }));
      setAlerts(dmAlerts);
    }

    buildAlerts();
    window.addEventListener("zk:cache:dm", buildAlerts);
    return () => window.removeEventListener("zk:cache:dm", buildAlerts);
  }, []);

  const routeLabel = ROUTE_LABELS[pathname] ?? "System";

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
        "h-12 flex items-center justify-between px-5 shrink-0 relative",
        "border-b border-zk-border/60",
        "bg-[rgba(5,5,5,0.95)] backdrop-blur-[8px]",
      )}>
        {/* ── Left ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <Terminal size={14} className="text-zk-green transition-all" />
            <span className="font-sans text-sm font-bold text-zk-green tracking-tight transition-all">
              Zeko OS
            </span>
          </Link>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-zk-muted/40 select-none">
            <span className="font-sans text-xs text-zk-muted/40">/</span>
            <span className="font-sans text-sm text-zk-muted/60">
              {routeLabel}
            </span>
          </div>
        </div>

        {/* ── Center: live clock + username ────────────────── */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <LiveClock />
          <span className="w-px h-3 bg-zk-border/60" />
          <span className="font-sans text-xs text-zk-muted/40 select-none">
            {(profile.displayName || session.name).toLowerCase()}
          </span>
        </div>

        {/* ── Right ────────────────────────────────────────── */}
        <div className="flex items-center gap-0.5">
          {/* Bell */}
          <div className="relative">
            <IconBtn
              icon={<Bell size={15} />}
              label="Alerts"
              badge={alerts.length > 0}
              active={alertsOpen}
              onClick={() => setAlertsOpen((v) => !v)}
            />
          </div>

          {/* Profile */}
          <IconBtn
            icon={<User size={15} />}
            label="Profile"
            active={profileOpen}
            onClick={() => setProfileOpen((v) => !v)}
          />

          <span className="w-px h-4 bg-zk-border/60 mx-1.5" aria-hidden="true" />

          {/* Logout */}
          <IconBtn
            icon={loggingOut
              ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
              : <LogOut size={15} />
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
