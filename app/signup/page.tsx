// app/signup/page.tsx
// Terminal-style self-service signup screen.
// Fields: Email → Password → Display Name → Create Account

"use client";

import { useState, useEffect } from "react";
import { useRouter }           from "next/navigation";
import { AlertTriangle, ArrowLeft, UserPlus } from "lucide-react";
import Link                    from "next/link";
import { GlassCard }           from "@/components/ui/GlassCard";
import { Button }              from "@/components/ui/Button";
import { Badge }               from "@/components/ui/Badge";
import { AuthTransition }      from "@/components/ui/AuthTransition";
import { cn }                  from "@/lib/utils";

// ─── Boot lines ───────────────────────────────────────────────
const BOOT_LINES = [
  "> KERNEL_VERSION=1.0.0",
  "> LOADING modules...",
  "> SIGNUP_MODULE status: ready",
  "> Enter registration data...",
];

// ─── Terminal field ───────────────────────────────────────────
function TerminalField({
  id,
  label,
  hint,
  type,
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  autoComplete,
}: {
  id:           string;
  label:        string;
  hint?:        string;
  type:         string;
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  disabled?:    boolean;
  autoFocus?:   boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="font-mono text-[11px] text-zk-muted tracking-widest uppercase"
        >
          {label}
        </label>
        {hint && (
          <span className="font-mono text-[10px] text-zk-muted/40 tracking-wider">
            {hint}
          </span>
        )}
      </div>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-zk-green text-sm select-none"
        >
          &gt;
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className={cn(
            "w-full pl-8 pr-4 py-2.5",
            "bg-zk-surface/60 border border-zk-border rounded-sm",
            "font-mono text-sm text-zk-white placeholder:text-zk-muted/50",
            "outline-none transition-all duration-200",
            "focus:border-zk-green focus:shadow-glow-sm",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "caret-zk-green"
          )}
        />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [displayName,   setDisplayName]   = useState("");
  const [error,         setError]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [redirectTo,    setRedirectTo]    = useState("/system/overview");

  // Boot sequence
  const [bootLines, setBootLines] = useState<string[]>([]);
  const bootDone = bootLines.length >= BOOT_LINES.length;

  useEffect(() => {
    let i = 0;
    const tick = () => {
      if (i < BOOT_LINES.length) {
        setBootLines((prev) => [...prev, BOOT_LINES[i]]);
        i++;
        setTimeout(tick, 180);
      }
    };
    setTimeout(tick, 200);
  }, []);

  // ── Client-side display name validation ─────────────────────
  function validateDisplayName(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return "Display name is required.";
    if ((trimmed.match(/ /g) ?? []).length > 1)
      return "Display name may contain at most one space.";
    return null;
  }

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password || !displayName.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const dnErr = validateDisplayName(displayName);
    if (dnErr) { setError(dnErr); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:       email.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Signup failed. Please try again.");
        return;
      }

      // Fire cinematic transition — router.push happens inside onComplete
      setRedirectTo(data.redirect ?? "/system/overview");
      setTransitioning(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    {transitioning && (
      <AuthTransition
        mode="login"
        onComplete={() => router.push(redirectTo)}
      />
    )}
    <main className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* ── Background effects ───────────────────────────────── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-[600px] h-[400px] rounded-full bg-zk-green/[0.04] blur-[100px]" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px)",
          backgroundSize: "100% 64px",
        }}
      />

      {/* ── Card ─────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">

        {/* Back to login */}
        <div className="mb-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-zk-muted hover:text-zk-green transition-colors duration-150 group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
            Back to login
          </Link>
        </div>

        {/* Logo / system label */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className="w-2 h-2 rounded-full bg-zk-green animate-pulse shadow-glow-sm"
            aria-hidden="true"
          />
          <span className="font-mono text-xs text-zk-green tracking-[0.2em] uppercase">
            Zeko OS — v1.0.0
          </span>
          <Badge variant="green" className="ml-auto">
            REGISTER
          </Badge>
        </div>

        <GlassCard featured>
          {/* Boot terminal */}
          <div className="mb-6 font-mono text-[11px] text-zk-muted leading-relaxed space-y-0.5 min-h-[72px]">
            {bootLines.map((line, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-zk-green/60">{line}</span>
              </div>
            ))}
            {!bootDone && (
              <span
                aria-hidden="true"
                className="inline-block w-2 h-3.5 bg-zk-green align-bottom animate-cursor-blink"
              />
            )}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-zk-green/20 to-transparent mb-6" />

          {/* Headline */}
          <h1 className="font-mono text-lg text-zk-white mb-1 tracking-tight">
            Create Account
          </h1>
          <p className="font-mono text-xs text-zk-muted mb-6">
            Register a new identity on the system.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <TerminalField
              id="email"
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="user@zeko.os"
              disabled={loading}
              autoFocus
              autoComplete="email"
            />
            <TerminalField
              id="password"
              label="Access Key"
              hint="min. 8 characters"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              disabled={loading}
              autoComplete="new-password"
            />
            <TerminalField
              id="displayName"
              label="Display Name"
              hint="letters, numbers, one space"
              type="text"
              value={displayName}
              onChange={setDisplayName}
              placeholder="John Doe"
              disabled={loading}
              autoComplete="off"
            />

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-sm border border-zk-red/30 bg-zk-red/5 text-zk-red font-mono text-xs">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={loading}
            >
              {loading ? "Creating account..." : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus size={14} />
                  Create Account
                </span>
              )}
            </Button>
          </form>

          {/* Footer — link back to login */}
          <p className="mt-5 font-mono text-[10px] text-zk-muted/60 text-center tracking-wider">
            Already have an account?{" "}
            <Link href="/login" className="text-zk-green hover:underline">
              Sign in
            </Link>
          </p>
        </GlassCard>

        {/* System status */}
        <p className="mt-4 font-mono text-[10px] text-zk-muted/50 text-center tracking-widest">
          ARCH=x86_64 &nbsp;|&nbsp; ENV=PRODUCTION &nbsp;|&nbsp; UPTIME 99.97%
        </p>
      </div>
    </main>
    </>
  );
}
