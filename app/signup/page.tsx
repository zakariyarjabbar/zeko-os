// app/signup/page.tsx
// Network-themed registration — same canvas backdrop as login,
// "NODE REGISTRATION" header, three port fields, burst on success.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter }        from "next/navigation";
import { motion }           from "framer-motion";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link                 from "next/link";
import { AuthTransition }   from "@/components/ui/AuthTransition";
import { NetworkBackground, type NetworkBgHandle } from "@/components/ui/NetworkBackground";
import { cn } from "@/lib/utils";

// ─── Pulsing hex logo ─────────────────────────────────────────
function HexLogo() {
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      {/* Outer ring — counter-clockwise */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: "1px solid rgba(0,255,65,0.18)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute"
          style={{
            top: -3, left: "50%", transform: "translateX(-50%)",
            width: 6, height: 6, borderRadius: "50%",
            background: "#00D4FF",
            boxShadow: "0 0 8px rgba(0,212,255,0.9), 0 0 16px rgba(0,212,255,0.4)",
          }}
        />
      </motion.div>
      {/* Inner ring — clockwise */}
      <motion.div
        className="absolute rounded-full"
        style={{ inset: 8, border: "1px dashed rgba(0,255,65,0.10)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 13, repeat: Infinity, ease: "linear" }}
      />
      {/* Center */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 14 }}>
        <div
          style={{
            width: "100%", height: "100%",
            border: "1px solid rgba(0,212,255,0.25)",
            background: "rgba(0,212,255,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span className="font-mono text-[9px] font-bold tracking-tight select-none" style={{ color: "#00D4FF" }}>
            +//
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Port-styled input field ───────────────────────────────────
function PortField({
  id, label, hint, type, value, onChange, placeholder,
  disabled, autoFocus, autoComplete, onType,
}: {
  id: string; label: string; hint?: string; type: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
  autoFocus?: boolean; autoComplete?: string;
  onType?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="font-mono text-[10px] tracking-[0.22em] uppercase transition-colors duration-200"
          style={{ color: focused ? "rgba(0,212,255,0.8)" : "rgba(107,122,107,1)" }}
        >
          {label}
        </label>
        <div className="flex items-center gap-2">
          {hint && (
            <span className="font-mono text-[9px] text-zk-muted/40 tracking-wider">{hint}</span>
          )}
          <span
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              background: focused
                ? "#00D4FF"
                : filled
                  ? "rgba(0,212,255,0.4)"
                  : "rgba(107,122,107,0.3)",
              boxShadow: focused ? "0 0 6px rgba(0,212,255,0.8)" : "none",
            }}
          />
        </div>
      </div>

      <div
        className="relative transition-all duration-200"
        style={{
          border: `1px solid ${focused ? "rgba(0,212,255,0.55)" : "rgba(0,212,255,0.10)"}`,
          boxShadow: focused ? "0 0 14px rgba(0,212,255,0.12), inset 0 0 8px rgba(0,212,255,0.03)" : "none",
          background: "rgba(0,0,0,0.38)",
        }}
      >
        {/* Left accent line */}
        <div
          className="absolute left-0 top-0 bottom-0 transition-all duration-200"
          style={{
            width: 2,
            background: focused
              ? "rgba(0,212,255,0.9)"
              : filled
                ? "rgba(0,212,255,0.3)"
                : "rgba(0,212,255,0.1)",
            boxShadow: focused ? "0 0 6px rgba(0,212,255,0.6)" : "none",
          }}
        />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => { onChange(e.target.value); onType?.(); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className={cn(
            "w-full pl-4 pr-20 py-3",
            "font-mono text-sm text-zk-white placeholder:text-zk-muted/35",
            "bg-transparent outline-none",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
          style={{ caretColor: "#00D4FF" }}
        />
        {filled && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] tracking-widest pointer-events-none"
            style={{ color: "rgba(0,212,255,0.45)" }}
          >
            {type === "password" ? "SECURED" : "OK"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Allocation progress bar ──────────────────────────────────
function AllocBar({ filled }: { filled: number }) {
  const steps = 3;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: steps }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] flex-1 transition-all duration-300"
          style={{
            background: i < filled
              ? `rgba(0,212,255,${0.4 + i * 0.18})`
              : "rgba(0,255,65,0.08)",
            boxShadow: i < filled ? "0 0 4px rgba(0,212,255,0.35)" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();
  const bgRef  = useRef<NetworkBgHandle | null>(null);

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [displayName,   setDisplayName]   = useState("");
  const [error,         setError]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [redirectTo,    setRedirectTo]    = useState("/system/overview");

  // Count how many of 3 fields have data (for AllocBar)
  const filledCount = [email, password, displayName].filter(Boolean).length;

  // Live stats (decorative)
  const [stats, setStats] = useState({ nodes: 847, pps: 12.4 });
  useEffect(() => {
    const t = setInterval(() => {
      setStats({
        nodes: 840 + Math.floor(Math.random() * 22),
        pps:   +(10.8 + Math.random() * 3.2).toFixed(1),
      });
    }, 2700);
    return () => clearInterval(t);
  }, []);

  const triggerRipple = useCallback(() => {
    bgRef.current?.ripple(window.innerWidth / 2, window.innerHeight / 2);
  }, []);

  function validateDisplayName(name: string): string | null {
    const t = name.trim();
    if (!t) return "Display name is required.";
    if ((t.match(/ /g) ?? []).length > 1)
      return "Display name may contain at most one space.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password || !displayName.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setError("Access token must be at least 8 characters.");
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
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }
      bgRef.current?.burst();
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
        <AuthTransition mode="login" onComplete={() => router.push(redirectTo)} />
      )}

      <main className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-zk-bg">
        <NetworkBackground bgRef={bgRef} />

        {/* Back link */}
        <div className="absolute top-6 left-6 z-20">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-zk-muted hover:text-zk-green transition-colors duration-150 group"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
            Back to login
          </Link>
        </div>

        {/* ── Card ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative z-10 w-full max-w-lg"
        >
          <div
            className="relative overflow-hidden"
            style={{
              background: "rgba(3, 5, 6, 0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(0,212,255,0.14)",
              boxShadow: "0 0 80px rgba(0,212,255,0.03), 0 24px 80px rgba(0,0,0,0.88), inset 0 1px 0 rgba(0,212,255,0.06)",
            }}
          >
            {/* Corner brackets — cyan accent */}
            <div className="absolute top-0 left-0 w-5 h-5 pointer-events-none" style={{ borderTop: "1px solid rgba(0,212,255,0.45)", borderLeft: "1px solid rgba(0,212,255,0.45)" }} />
            <div className="absolute top-0 right-0 w-5 h-5 pointer-events-none" style={{ borderTop: "1px solid rgba(0,212,255,0.45)", borderRight: "1px solid rgba(0,212,255,0.45)" }} />
            <div className="absolute bottom-0 left-0 w-5 h-5 pointer-events-none" style={{ borderBottom: "1px solid rgba(0,212,255,0.45)", borderLeft: "1px solid rgba(0,212,255,0.45)" }} />
            <div className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none" style={{ borderBottom: "1px solid rgba(0,212,255,0.45)", borderRight: "1px solid rgba(0,212,255,0.45)" }} />

            {/* Scan line — cyan */}
            <motion.div
              className="absolute left-0 right-0 h-px pointer-events-none z-10"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.3) 20%, rgba(0,212,255,0.6) 50%, rgba(0,212,255,0.3) 80%, transparent 100%)",
                boxShadow: "0 0 8px rgba(0,212,255,0.35)",
              }}
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 4.2, repeat: Infinity, repeatDelay: 3.5, ease: "linear" }}
            />

            {/* ── Header ─────────────────────────────────────── */}
            <div
              className="flex items-center gap-4 px-6 pt-6 pb-4"
              style={{ borderBottom: "1px solid rgba(0,212,255,0.06)" }}
            >
              <HexLogo />
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-sm font-bold tracking-[0.12em] text-zk-white">
                  ZEKO<span style={{ color: "#00D4FF" }}>//</span>NET
                </span>
                <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-zk-muted">
                  Node Registration
                </span>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#00D4FF", boxShadow: "0 0 6px rgba(0,212,255,0.8)" }}
                  />
                  <span className="font-mono text-[9px] tracking-[0.2em]" style={{ color: "#00D4FF" }}>
                    OPEN
                  </span>
                </div>
                <span className="font-mono text-[8px] text-zk-muted/50 tracking-wider">
                  SLOTS AVAILABLE
                </span>
              </div>
            </div>

            {/* ── Live stats strip ───────────────────────────── */}
            <div
              className="flex items-center gap-5 px-6 py-2"
              style={{
                background: "rgba(0,212,255,0.018)",
                borderBottom: "1px solid rgba(0,212,255,0.06)",
              }}
            >
              {[
                ["NODES",  stats.nodes.toString()],
                ["PKT/S",  `${stats.pps}k`],
                ["STATUS", "NOMINAL"],
              ].map(([k, v]) => (
                <span key={k} className="font-mono text-[9px] tracking-widest text-zk-muted">
                  {k}:{" "}
                  <motion.span
                    key={v}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{ color: "rgba(0,212,255,0.6)" }}
                  >
                    {v}
                  </motion.span>
                </span>
              ))}
              <span className="ml-auto font-mono text-[9px] tracking-widest text-zk-muted/45">
                ■ REG OPEN
              </span>
            </div>

            {/* ── Form body ──────────────────────────────────── */}
            <div className="px-6 pt-7 pb-7">
              {/* Title */}
              <h1
                className="font-mono font-bold tracking-[0.18em] uppercase mb-1"
                style={{ fontSize: "1.05rem", color: "#F0F6F0", textShadow: "0 0 20px rgba(0,212,255,0.12)" }}
              >
                Register New Node
              </h1>
              <p className="font-mono text-[11px] text-zk-muted tracking-wide mb-5">
                Provision a new identity on the network.
              </p>

              {/* Allocation progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[9px] tracking-widest text-zk-muted/60 uppercase">
                    Field allocation
                  </span>
                  <span className="font-mono text-[9px] tracking-widest" style={{ color: "rgba(0,212,255,0.5)" }}>
                    {filledCount}/3
                  </span>
                </div>
                <AllocBar filled={filledCount} />
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <PortField
                  id="email"
                  label="Email Endpoint"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="user@zeko.net"
                  disabled={loading}
                  autoFocus
                  autoComplete="email"
                  onType={triggerRipple}
                />
                <PortField
                  id="password"
                  label="Access Token"
                  hint="min 8 chars"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="new-password"
                  onType={triggerRipple}
                />
                <PortField
                  id="displayName"
                  label="Node Alias"
                  hint="one space allowed"
                  type="text"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="John Doe"
                  disabled={loading}
                  autoComplete="off"
                  onType={triggerRipple}
                />

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2 px-3 py-2.5"
                    style={{
                      border: "1px solid rgba(255,59,59,0.25)",
                      background: "rgba(255,59,59,0.05)",
                    }}
                  >
                    <AlertTriangle size={12} className="text-zk-red shrink-0 mt-0.5" />
                    <span className="font-mono text-[11px] text-zk-red">{error}</span>
                  </motion.div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full overflow-hidden font-mono text-sm tracking-[0.18em] uppercase py-3 px-6 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                  style={{
                    border: "1px solid rgba(0,212,255,0.4)",
                    background: "rgba(0,212,255,0.05)",
                    color: "#00D4FF",
                    boxShadow: loading ? "0 0 20px rgba(0,212,255,0.14)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = "rgba(0,212,255,0.09)";
                      e.currentTarget.style.boxShadow = "0 0 24px rgba(0,212,255,0.22)";
                      e.currentTarget.style.borderColor = "rgba(0,212,255,0.7)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0,212,255,0.05)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)";
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.06) 50%, transparent 100%)",
                    }}
                  />
                  <span className="relative flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <span className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{ background: "#00D4FF" }}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 0.9, delay: i * 0.2, repeat: Infinity }}
                            />
                          ))}
                        </span>
                        <span>Provisioning...</span>
                      </>
                    ) : (
                      <>
                        <span className="opacity-50">──▶</span>
                        <span>Register Node</span>
                        <span className="opacity-50">──▶</span>
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* Footer link */}
              <p className="mt-6 font-mono text-[10px] text-zk-muted/55 text-center tracking-wider">
                Already registered?{" "}
                <Link href="/login" className="hover:text-zk-green transition-colors duration-150" style={{ color: "rgba(0,212,255,0.65)" }}>
                  Connect to node
                </Link>
              </p>
            </div>
          </div>

          {/* Below-card status */}
          <p className="mt-3 font-mono text-[9px] text-zk-muted/35 text-center tracking-[0.25em]">
            PROTOCOL: TLS 1.3 &nbsp;·&nbsp; CIPHER: AES-256-GCM &nbsp;·&nbsp; AUTH: HMAC-SHA256
          </p>
        </motion.div>
      </main>
    </>
  );
}
