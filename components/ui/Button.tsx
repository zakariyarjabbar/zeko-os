// components/ui/Button.tsx
// Highly reusable button component with primary, outline, and ghost variants.

"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// ─── Button Variants (CVA) ──────────────────────────────────
const buttonVariants = cva(
  // Base styles applied to every variant
  [
    "inline-flex items-center justify-center gap-2",
    "font-mono text-sm font-medium tracking-wide",
    "rounded-sm border transition-all duration-200 ease-out",
    "cursor-pointer select-none",
    "disabled:opacity-40 disabled:pointer-events-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zk-green focus-visible:ring-offset-2 focus-visible:ring-offset-zk-bg",
    "relative overflow-hidden",
  ],
  {
    variants: {
      variant: {
        // ── Solid Green ─ primary CTA
        primary: [
          "bg-zk-green text-zk-bg border-zk-green",
          "hover:bg-transparent hover:text-zk-green hover:shadow-glow-md",
          "active:scale-[0.98]",
        ],
        // ── Green Outline ─ secondary CTA
        outline: [
          "bg-transparent text-zk-green border-zk-green/40",
          "hover:border-zk-green hover:bg-zk-green/8 hover:shadow-glow-sm",
          "active:scale-[0.98]",
        ],
        // ── Ghost ─ tertiary / nav links
        ghost: [
          "bg-transparent text-zk-slate border-transparent",
          "hover:text-zk-white hover:border-zk-border",
          "active:scale-[0.98]",
        ],
        // ── Danger ─ destructive actions
        danger: [
          "bg-zk-red/10 text-zk-red border-zk-red/30",
          "hover:bg-zk-red/20 hover:border-zk-red/60",
          "active:scale-[0.98]",
        ],
      },
      size: {
        sm: "h-8  px-3 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-9 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

// ─── Props ──────────────────────────────────────────────────
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Show a loading spinner and disable interaction */
  isLoading?: boolean;
  /** Icon element rendered before children */
  leftIcon?: React.ReactNode;
  /** Icon element rendered after children */
  rightIcon?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {/* Loading spinner */}
        {isLoading && (
          <Loader2
            className="animate-spin"
            size={14}
            aria-hidden="true"
          />
        )}

        {/* Left icon */}
        {!isLoading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {children}

        {/* Right icon */}
        {!isLoading && rightIcon && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
