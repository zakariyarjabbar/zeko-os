// components/system/DisplayNameGate.tsx
// Full-screen blocking modal shown when the logged-in user has no display name.
// The user cannot interact with anything until they submit a valid display name.
// On success, router.refresh() re-renders the server layout — gate disappears.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserCheck } from "lucide-react";
import { motion, AnimatePresence }  from "framer-motion";
import { cn } from "@/lib/utils";

interface DisplayNameGateProps {
  /** The current display_name from the server — empty string means gate is active */
  initialDisplayName: string;
}

export function DisplayNameGate({ initialDisplayName }: DisplayNameGateProps) {
  const router = useRouter();
  const [value,   setValue]   = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  // Gate is inactive if user already has a display name
  if (initialDisplayName.trim() || done) return null;

  function validate(name: string): string | null {
    const t = name.trim();
    if (!t)                                          return "Display name is required.";
    if ((t.match(/ /g) ?? []).length > 1)            return "Display name may contain at most one space.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const err = validate(value);
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ displayName: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save display name.");
        return;
      }
      // Optimistically hide the gate before refresh completes
      setDone(true);
      // Re-render server layout so profile.displayName updates
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="gate-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "fixed inset-0 z-[500]",
          "bg-black/85 backdrop-blur-[6px]",
          "flex items-center justify-center px-4"
        )}
      >
        <motion.div
          key="gate-card"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 12, scale: 0.97  }}
          transition={{ type: "spring", stiffness: 340, damping: 28, delay: 0.05 }}
          className={cn(
            "w-full max-w-sm",
            "bg-[rgba(10,15,10,0.98)] border border-zk-border rounded",
            "shadow-[0_0_60px_rgba(0,0,0,0.8)]",
            "overflow-hidden"
          )}
        >
          {/* Top accent bar */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-zk-green/40 to-transparent" />

          <div className="px-6 py-7 space-y-6">
            {/* Icon + heading */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded flex items-center justify-center",
                "border border-zk-green/30 bg-zk-green/8"
              )}>
                <UserCheck size={20} className="text-zk-green" />
              </div>
              <div>
                <h2 className="font-sans text-base font-semibold text-zk-white">
                  Identity Required
                </h2>
                <p className="mt-1 font-sans text-sm text-zk-muted leading-relaxed">
                  You must set a display name before accessing the system.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="gate-display-name"
                    className="font-sans text-xs font-medium text-zk-muted/60 uppercase tracking-wide"
                  >
                    Display Name
                  </label>
                  <span className="font-sans text-xs text-zk-muted/40">
                    letters, numbers, one space
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="gate-display-name"
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="John Doe"
                    disabled={loading}
                    autoFocus
                    autoComplete="off"
                    className={cn(
                      "w-full pl-4 pr-4 py-2.5",
                      "bg-zk-surface/60 border border-zk-border rounded",
                      "font-sans text-sm text-zk-white placeholder:text-zk-muted/50",
                      "outline-none transition-all duration-200",
                      "focus:border-zk-green focus:shadow-glow-sm",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      "caret-zk-green"
                    )}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded border border-zk-red/30 bg-zk-red/5 text-zk-red font-sans text-sm">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full h-9 rounded border font-sans text-sm font-medium",
                  "flex items-center justify-center gap-2 transition-all duration-150",
                  "border-zk-green/40 bg-zk-green/10 text-zk-green",
                  "hover:bg-zk-green/20 hover:border-zk-green/70 hover:shadow-glow-sm",
                  "disabled:opacity-40 disabled:pointer-events-none"
                )}
              >
                {loading
                  ? <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
                  : <UserCheck size={13} />
                }
                {loading ? "Saving..." : "Confirm Identity"}
              </button>
            </form>
          </div>

          {/* Bottom accent */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-zk-green/20 to-transparent" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
