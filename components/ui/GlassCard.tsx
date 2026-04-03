// components/ui/GlassCard.tsx
// Glassmorphism card wrapper — dark translucent background,
// thin green border, subtle hover glow. Used in Features grid.

"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  /** Highlight the card with a stronger glow border (e.g., featured card) */
  featured?: boolean;
  /** Disable the default padding */
  noPadding?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}

export function GlassCard({
  children,
  className,
  featured = false,
  noPadding = false,
  as: Tag = "div",
}: GlassCardProps) {
  return (
    <Tag
      className={cn(
        // Background & blur
        "relative rounded-lg overflow-hidden",
        "bg-[rgba(13,17,23,0.75)] backdrop-blur-[12px]",
        // Border
        "border transition-all duration-300 ease-out",
        // Default padding
        !noPadding && "p-6",
        // Default state
        featured
          ? "border-zk-green/30 shadow-[0_0_20px_rgba(0,255,65,0.10)]"
          : "border-zk-border",
        // Hover state
        "hover:border-zk-green/30 hover:shadow-[0_4px_24px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,255,65,0.08)]",
        // Inner top highlight line
        "before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-zk-green/20 before:to-transparent",
        className
      )}
    >
      {children}
    </Tag>
  );
}
