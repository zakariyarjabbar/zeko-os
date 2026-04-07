// components/system/SystemSidebar.tsx
// Left navigation rail for the system shell.
// Locked items show a tooltip on hover and block navigation
// if the current user lacks the required permission.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Inbox, Users, Lock, ShieldCheck } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/components/system/SessionContext";
import { isFounder, canViewInbox, canViewUsers } from "@/lib/permissions";

// ─── Permission check for nav items ──────────────────────────
function checkFlag(requireFlag: string, flags: string[]): boolean {
  if (requireFlag === "view-inbox")    return canViewInbox(flags);
  if (requireFlag === "moderator")     return canViewUsers(flags);
  if (requireFlag === "Administrator") return isFounder(flags);
  return flags.includes(requireFlag);
}

// ─── Nav config ───────────────────────────────────────────────
interface NavItem {
  href:        string;
  label:       string;
  icon:        React.ElementType;
  requireFlag?: string; // access flag required to use this item
  badge?:      "unread";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/system/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/system/chat",     label: "Chat",     icon: MessageSquare    },
  { href: "/system/inbox",    label: "Inbox",    icon: Inbox,       badge: "unread", requireFlag: "view-inbox" },
  { href: "/system/users",    label: "Users",    icon: Users,       requireFlag: "moderator" },
  { href: "/system/roles",    label: "Roles",    icon: ShieldCheck, requireFlag: "Administrator" },
];

// ─── Locked item ──────────────────────────────────────────────
function LockedItem({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  const [tip, setTip] = useState(false);
  const tipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showTip() {
    tipRef.current = setTimeout(() => setTip(true), 120);
  }
  function hideTip() {
    if (tipRef.current) clearTimeout(tipRef.current);
    setTip(false);
  }

  return (
    <div
      className="relative"
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-sm",
          "font-mono text-xs tracking-wide",
          "border border-transparent",
          "text-zk-muted/30 cursor-not-allowed select-none",
          "transition-all duration-150",
          "hover:bg-zk-red/5 hover:border-zk-red/15"
        )}
        aria-disabled="true"
      >
        <span className="shrink-0 text-zk-muted/30">
          <Icon size={15} />
        </span>
        <span className="flex-1">{label}</span>
        <Lock size={10} className="text-zk-muted/30 shrink-0" />
      </div>

      {/* Tooltip */}
      {tip && (
        <div className={cn(
          "absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50",
          "whitespace-nowrap px-2.5 py-1.5 rounded-sm",
          "bg-[rgba(10,15,10,0.98)] border border-zk-red/30",
          "shadow-[0_0_12px_rgba(255,59,59,0.15)]",
          "pointer-events-none"
        )}>
          <div className="flex items-center gap-1.5">
            <Lock size={9} className="text-zk-red" />
            <span className="font-mono text-[9px] text-zk-red tracking-widest uppercase">
              Insufficient permissions
            </span>
          </div>
          <p className="font-mono text-[9px] text-zk-muted/50 mt-0.5">
            You do not have access to this module
          </p>
          {/* Arrow */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zk-red/30" />
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export function SystemSidebar() {
  const pathname = usePathname();
  const profile  = useProfile();
  const founder  = isFounder(profile.accessFlags);
  const [unread, setUnread] = useState(0);

  // Poll inbox unread count every 30s
  useEffect(() => {
    async function fetchUnread() {
      try {
        const res  = await fetch("/api/inbox");
        const data = await res.json();
        if (Array.isArray(data)) {
          setUnread(data.filter((m: { read: boolean }) => !m.read).length);
        }
      } catch { /* silent */ }
    }
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className={cn(
      "w-48 shrink-0 flex flex-col",
      "border-r border-zk-border bg-zk-surface/40"
    )}>
      <div className="px-4 pt-5 pb-2">
        <span className="font-mono text-[9px] text-zk-muted/60 tracking-[0.2em] uppercase">
          Navigation
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, requireFlag, badge }) => {
          const locked = !!requireFlag && !checkFlag(requireFlag, profile.accessFlags);

          // Render locked version
          if (locked) {
            return <LockedItem key={href} label={label} icon={Icon} />;
          }

          const active   = pathname === href || pathname.startsWith(href + "/");
          const showBadge = badge === "unread" && unread > 0 && !active;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-sm",
                "font-mono text-xs tracking-wide",
                "transition-all duration-150",
                active
                  ? "bg-zk-green/8 text-zk-green border border-zk-border shadow-glow-sm"
                  : "text-zk-slate border border-transparent hover:text-zk-white hover:bg-zk-green/5 hover:border-zk-border"
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className={cn("shrink-0", active ? "text-zk-green" : "")}>
                <Icon size={15} />
              </span>
              <span className="flex-1">{label}</span>

              {showBadge && (
                <span className="font-mono text-[9px] bg-zk-green text-zk-bg px-1.5 py-0.5 rounded-sm leading-none">
                  {unread}
                </span>
              )}
              {active && (
                <span aria-hidden="true" className="w-1 h-1 rounded-full bg-zk-green shadow-glow-sm" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Founder indicator at bottom */}
      {founder && (
        <div className="mt-auto px-4 pb-4 pt-2">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm border border-zk-green/15 bg-zk-green/5">
            <ShieldBadge />
            <span className="font-mono text-[9px] text-zk-green/60 tracking-widest">
              FOUNDER
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}

// Small inline shield icon to avoid extra import
function ShieldBadge() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-zk-green shrink-0">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
