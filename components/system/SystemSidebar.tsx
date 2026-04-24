// components/system/SystemSidebar.tsx
// Left navigation rail for the system shell.
// Locked items show a tooltip on hover and block navigation
// if the current user lacks the required permission.

"use client";

import { LayoutDashboard, MessageSquare, Inbox, Users, Lock, ShieldCheck, UserCog } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/components/system/SessionContext";
import { useSystemView, type SystemView } from "@/components/system/SystemViewContext";
import { isFounder, canViewInbox, canViewUsers, canManageRoles, canManagePermissions } from "@/lib/permissions";
import { PERM } from "@/lib/permission-ids";
import { getAppCache } from "@/lib/app-cache";

// ─── Permission check for nav items ──────────────────────────
function checkFlag(requireFlag: string, ids: readonly string[]): boolean {
  if (requireFlag === "view-inbox")          return canViewInbox(ids);
  if (requireFlag === "moderator")           return canViewUsers(ids);
  if (requireFlag === "Administrator")       return isFounder(ids);
  if (requireFlag === "roles-or-permissions") return isFounder(ids) || canManageRoles(ids) || canManagePermissions(ids);
  // Legacy: requireFlag may be a UUID directly
  return ids.includes(requireFlag) || ids.includes(PERM.Administrator);
}

// ─── Nav config ───────────────────────────────────────────────
interface NavItem {
  view:        SystemView;
  label:       string;
  icon:        React.ElementType;
  requireFlag?: string;
  badge?:      "unread";
}

const NAV_ITEMS: NavItem[] = [
  { view: "overview", label: "Overview", icon: LayoutDashboard },
  { view: "chat",     label: "Chat",     icon: MessageSquare    },
  { view: "inbox",    label: "Inbox",    icon: Inbox,       badge: "unread", requireFlag: "view-inbox" },
  { view: "users",    label: "Users",    icon: Users },
  { view: "roles",    label: "Roles",    icon: ShieldCheck, requireFlag: "roles-or-permissions" },
  { view: "profile",  label: "Profile",  icon: UserCog },
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
          "flex items-center gap-2.5 px-3 py-2 rounded",
          "font-sans text-sm",
          "text-zk-muted/30 cursor-not-allowed select-none",
          "transition-all duration-150",
          "hover:bg-zk-red/5"
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
          "whitespace-nowrap px-3 py-2 rounded",
          "bg-[rgba(10,15,10,0.98)] border border-zk-red/30",
          "shadow-[0_0_12px_rgba(255,59,59,0.15)]",
          "pointer-events-none"
        )}>
          <div className="flex items-center gap-1.5">
            <Lock size={9} className="text-zk-red" />
            <span className="font-sans text-xs text-zk-red">
              Insufficient permissions
            </span>
          </div>
          <p className="font-sans text-xs text-zk-muted/50 mt-0.5">
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
  const { view, navigate } = useSystemView();
  const profile  = useProfile();
  const founder  = isFounder(profile.accessFlags);
  const [unread, setUnread] = useState(0);

  // ── Unread count — driven by app cache, no polling ──────────
  useEffect(() => {
    if (!canViewInbox(profile.accessFlags)) return;

    function syncUnread() {
      const cached = getAppCache().getInbox();
      if (cached) setUnread(cached.filter((m) => !m.read).length);
    }

    syncUnread();
    window.addEventListener("zk:cache:inbox", syncUnread);
    return () => window.removeEventListener("zk:cache:inbox", syncUnread);
  }, [profile.accessFlags]);

  return (
    <aside className={cn(
      "w-48 shrink-0 flex flex-col",
      "border-r border-zk-border bg-zk-surface/40"
    )}>
      <div className="px-4 pt-5 pb-3">
        <span className="font-sans text-xs text-zk-muted/50 uppercase tracking-wide">
          Navigation
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(({ view: itemView, label, icon: Icon, requireFlag, badge }) => {
          const locked = !!requireFlag && !checkFlag(requireFlag, profile.accessFlags);

          if (locked) {
            return <LockedItem key={itemView} label={label} icon={Icon} />;
          }

          const active    = view === itemView;
          const showBadge = badge === "unread" && unread > 0 && !active;

          return (
            <button
              key={itemView}
              onClick={() => navigate(itemView)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded text-left w-full",
                "font-sans text-sm",
                "transition-all duration-150",
                active
                  ? "border-l-2 border-l-zk-green bg-zk-green/[0.06] text-zk-green pl-[10px]"
                  : "text-zk-slate hover:text-zk-white hover:bg-zk-green/5"
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className={cn("shrink-0", active ? "text-zk-green" : "")}>
                <Icon size={15} />
              </span>
              <span className="flex-1">{label}</span>

              {showBadge && (
                <span className="font-sans text-xs bg-zk-green text-zk-bg px-1.5 py-0.5 rounded leading-none">
                  {unread}
                </span>
              )}
              {active && (
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-zk-green" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Founder indicator at bottom */}
      {founder && (
        <div className="mt-auto px-4 pb-4 pt-2">
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded border border-zk-green/15 bg-zk-green/5">
            <ShieldBadge />
            <span className="font-sans text-xs text-zk-green/70 uppercase tracking-wide">
              Founder
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-zk-green shrink-0">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
