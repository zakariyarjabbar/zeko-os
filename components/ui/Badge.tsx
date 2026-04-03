// components/ui/Badge.tsx
// Small tag/badge component used inside feature cards and elsewhere.

import { cn } from "@/lib/utils";

// ─── Badge Variants ──────────────────────────────────────────
type BadgeVariant = "green" | "muted" | "amber" | "red" | "cyan" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

// ─── Variant Styles Map ──────────────────────────────────────
const variantStyles: Record<BadgeVariant, string> = {
  green:   "bg-zk-green/10 text-zk-green   border-zk-green/20",
  muted:   "bg-white/5     text-zk-slate   border-white/10",
  amber:   "bg-zk-amber/10 text-zk-amber   border-zk-amber/20",
  red:     "bg-zk-red/10   text-zk-red     border-zk-red/20",
  cyan:    "bg-zk-cyan/10  text-zk-cyan    border-zk-cyan/20",
  outline: "bg-transparent text-zk-muted   border-zk-border",
};

// ─── Component ──────────────────────────────────────────────
export function Badge({
  children,
  variant = "green",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        // Base
        "inline-flex items-center gap-1",
        "font-mono text-[10px] font-medium tracking-widest uppercase",
        "px-2 py-0.5 rounded-sm border",
        // Variant
        variantStyles[variant],
        // Custom
        className
      )}
    >
      {children}
    </span>
  );
}
