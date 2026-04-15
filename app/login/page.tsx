// app/login/page.tsx
// Terminal-style login screen — email + password only.
// On success → cinematic AuthTransition → /system/overview.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GlassCard }        from "@/components/ui/GlassCard";
import { Button }           from "@/components/ui/Button";
import { Badge }            from "@/components/ui/Badge";
import { AuthTransition }   from "@/components/ui/AuthTransition";
import { cn } from "@/lib/utils";

// ─── Typing boot lines ────────────────────────────────────────
const BOOT_LINES = [
  "> KERNEL_VERSION=1.0.0",
  "> LOADING modules...",
  "> AUTH_MODULE status: ready",
  "> Awaiting credentials...",
];

// ─── Minimal field wrapper ─────────────────────────────────────
function TerminalField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[11px] text-zk-muted tracking-widest uppercase"
      >
        {label}
      </label>
      <div className="relative">
        {/* Prompt glyph */}
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
          autoComplete={type === "password" ? "current-password" : "email"}
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
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Boot sequence display
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

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Both fields are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }

      // Fire cinematic transition — router.push happens inside onComplete
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
        onComplete={() => router.push("/system/overview")}
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

        {/* Back to landing */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-zk-muted hover:text-zk-green transition-colors duration-150 group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
            Back to landing
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
            AUTH
          </Badge>
        </div>

        <GlassCard featured>
          {/* Boot sequence terminal */}
          <div className="mb-6 font-mono text-[11px] text-zk-muted leading-relaxed space-y-0.5 min-h-[72px]">
            {bootLines.map((line, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-zk-green/60">{line}</span>
              </div>
            ))}
            {/* Blinking cursor while booting */}
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
            System Access
          </h1>
          <p className="font-mono text-xs text-zk-muted mb-6">
            Enter your credentials to authenticate.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <TerminalField
              id="email"
              label="Identifier"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="user@zeko.os"
              disabled={loading}
              autoFocus
            />
            <TerminalField
              id="password"
              label="Access Key"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              disabled={loading}
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
              {loading ? "Authenticating..." : "Authenticate"}
            </Button>
          </form>

          {/* Footer — signup link */}
          <p className="mt-5 font-mono text-[10px] text-zk-muted/60 text-center tracking-wider">
            No account?{" "}
            <Link href="/signup" className="text-zk-green hover:underline">
              Create one
            </Link>
          </p>
        </GlassCard>

        {/* System status line */}
        <p className="mt-4 font-mono text-[10px] text-zk-muted/50 text-center tracking-widest">
          ARCH=x86_64 &nbsp;|&nbsp; ENV=PRODUCTION &nbsp;|&nbsp; UPTIME 99.97%
        </p>
      </div>
    </main>
    </>
  );
}
