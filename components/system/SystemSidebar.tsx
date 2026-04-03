// components/system/SystemSidebar.tsx
// Left navigation rail for the system shell.
// Links: Overview, Chat — highlights the active route.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Nav items ────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    href:  "/system/overview",
    label: "Overview",
    icon:  <LayoutDashboard size={15} />,
  },
  {
    href:  "/system/chat",
    label: "Chat",
    icon:  <MessageSquare size={15} />,
  },
] as const;

// ─── Component ────────────────────────────────────────────────
export function SystemSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "w-48 shrink-0 flex flex-col",
        "border-r border-zk-border bg-zk-surface/40",
      )}
    >
      {/* Section label */}
      <div className="px-4 pt-5 pb-2">
        <span className="font-mono text-[9px] text-zk-muted/60 tracking-[0.2em] uppercase">
          Navigation
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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
                {icon}
              </span>
              {label}
              {/* Active indicator dot */}
              {active && (
                <span
                  aria-hidden="true"
                  className="ml-auto w-1 h-1 rounded-full bg-zk-green shadow-glow-sm"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
