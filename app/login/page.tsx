// app/login/page.tsx
// Network-themed login — animated node graph bg, orbital header,
// live stats strip, port-styled inputs, ripple-on-keystroke.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter }        from "next/navigation";
import { motion }           from "framer-motion";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link                 from "next/link";
import { AuthTransition }   from "@/components/ui/AuthTransition";
import { NetworkBackground, type NetworkBgHandle } from "@/components/ui/NetworkBackground";
import { cn } from "@/lib/utils";

// ─── Orbit ring around the logo ───────────────────────────────
function OrbitRing() {
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      {/* Outer rotating ring with orbiting dot */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: "1px solid rgba(0,255,65,0.22)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute"
          style={{
            top: -3, left: "50%", transform: "translateX(-50%)",
            width: 6, height: 6, borderRadius: "50%",
            background: "#00FF41",
            boxShadow: "0 0 8px rgba(0,255,65,0.9), 0 0 18px rgba(0,255,65,0.4)",
          }}
        />
      </motion.div>
      {/* Inner reverse ring */}
      <motion.div
        className="absolute rounded-full"
        style={{ inset: 8, border: "1px dashed rgba(0,255,65,0.10)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
      />
      {/* Center box */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: 14 }}
      >
        <div
          style={{
            width: "100%", height: "100%",
            border: "1px solid rgba(0,255,65,0.28)",
            background: "rgba(0,255,65,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span className="font-mono text-[9px] text-zk-green font-bold tracking-tight select-none">
            Z://
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Signal strength bars ─────────────────────────────────────
function SignalBars({ bars = 4 }: { bars?: number }) {
  return (
    <div className="flex items-end gap-[2px]">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm transition-colors duration-500"
          style={{
            height: `${i * 3 + 3}px`,
            background: i <= bars
              ? `rgba(0,255,65,${0.4 + i * 0.15})`
              : "rgba(0,255,65,0.12)",
            boxShadow: i <= bars ? "0 0 4px rgba(0,255,65,0.4)" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── Port-styled input field ───────────────────────────────────
function PortField({
  id, label, type, value, onChange, placeholder,
  disabled, autoFocus, autoComplete, onType,
}: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
  autoFocus?: boolean; autoComplete?: string;
  onType?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className={cn(
            "font-mono text-[10px] tracking-[0.22em] uppercase transition-colors duration-200",
            focused ? "text-zk-green/80" : "text-zk-muted"
          )}
        >
          {label}
        </label>
        {/* Status dot */}
        <span
          className="w-1.5 h-1.5 rounded-full transition-all duration-300"
          style={{
            background: focused
              ? "#00FF41"
              : filled
                ? "rgba(0,255,65,0.4)"
                : "rgba(107,122,107,0.3)",
            boxShadow: focused ? "0 0 6px rgba(0,255,65,0.8)" : "none",
          }}
        />
      </div>

      {/* Input wrapper */}
      <div
        className="relative transition-all duration-200"
        style={{
          border: `1px solid ${focused ? "rgba(0,255,65,0.55)" : "rgba(0,255,65,0.10)"}`,
          boxShadow: focused ? "0 0 14px rgba(0,255,65,0.12), inset 0 0 8px rgba(0,255,65,0.03)" : "none",
          background: "rgba(0,0,0,0.38)",
        }}
      >
        {/* Left accent line */}
        <div
          className="absolute left-0 top-0 bottom-0 transition-all duration-200"
          style={{
            width: 2,
            background: focused
              ? "rgba(0,255,65,0.9)"
              : filled
                ? "rgba(0,255,65,0.3)"
                : "rgba(0,255,65,0.1)",
            boxShadow: focused ? "0 0 6px rgba(0,255,65,0.6)" : "none",
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
            "bg-transparent outline-none caret-zk-green",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        />
        {/* Right status text */}
        {filled && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] tracking-widest pointer-events-none"
            style={{ color: "rgba(0,255,65,0.45)" }}
          >
            {type === "password" ? "SECURED" : "OK"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export default function LoginPage() {
  const router  = useRouter();
  const bgRef   = useRef<NetworkBgHandle | null>(null);

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [error,         setError]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Live network stats (decorative)
  const [stats, setStats] = useState({ nodes: 847, pps: 12.4, latency: "<1" });
  useEffect(() => {
    const t = setInterval(() => {
      setStats({
        nodes:   840 + Math.floor(Math.random() * 22),
        pps:     +(10.8 + Math.random() * 3.2).toFixed(1),
        latency: Math.random() > 0.82 ? "2" : "<1",
      });
    }, 2600);
    return () => clearInterval(t);
  }, []);

  // Emit ripple from screen center on every keystroke
  const triggerRipple = useCallback(() => {
    bgRef.current?.ripple(window.innerWidth / 2, window.innerHeight / 2);
  }, []);

  // ── Submit ───────────────────────────────────────────────────
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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Authentication failed.");
        return;
      }
      bgRef.current?.burst();
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
        <AuthTransition mode="login" onComplete={() => router.push("/system/overview")} />
      )}

      <main className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-zk-bg">
        {/* Canvas network background */}
        <NetworkBackground bgRef={bgRef} />

        {/* Back link */}
        <div className="absolute top-6 left-6 z-20">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-zk-muted hover:text-zk-green transition-colors duration-150 group"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
            Back
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
              background: "rgba(3, 6, 3, 0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(0,255,65,0.16)",
              boxShadow: "0 0 80px rgba(0,255,65,0.04), 0 24px 80px rgba(0,0,0,0.88), inset 0 1px 0 rgba(0,255,65,0.07)",
            }}
          >
            {/* Corner bracket decorations */}
            <div className="absolute top-0 left-0 w-5 h-5 pointer-events-none" style={{ borderTop: "1px solid rgba(0,255,65,0.5)", borderLeft: "1px solid rgba(0,255,65,0.5)" }} />
            <div className="absolute top-0 right-0 w-5 h-5 pointer-events-none" style={{ borderTop: "1px solid rgba(0,255,65,0.5)", borderRight: "1px solid rgba(0,255,65,0.5)" }} />
            <div className="absolute bottom-0 left-0 w-5 h-5 pointer-events-none" style={{ borderBottom: "1px solid rgba(0,255,65,0.5)", borderLeft: "1px solid rgba(0,255,65,0.5)" }} />
            <div className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none" style={{ borderBottom: "1px solid rgba(0,255,65,0.5)", borderRight: "1px solid rgba(0,255,65,0.5)" }} />

            {/* Scan line */}
            <motion.div
              className="absolute left-0 right-0 h-px pointer-events-none z-10"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(0,255,65,0.35) 20%, rgba(0,255,65,0.7) 50%, rgba(0,255,65,0.35) 80%, transparent 100%)",
                boxShadow: "0 0 8px rgba(0,255,65,0.4)",
              }}
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 3, ease: "linear" }}
            />

            {/* ── Header ─────────────────────────────────────── */}
            <div
              className="flex items-center gap-4 px-6 pt-6 pb-4"
              style={{ borderBottom: "1px solid rgba(0,255,65,0.07)" }}
            >
              <OrbitRing />
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-sm font-bold tracking-[0.12em] text-zk-white">
                  ZEKO<span className="text-zk-green">//</span>NET
                </span>
                <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-zk-muted">
                  Authentication Module
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2.5">
                <SignalBars bars={4} />
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-zk-green"
                    style={{ boxShadow: "0 0 6px rgba(0,255,65,0.8)" }}
                  />
                  <span className="font-mono text-[9px] tracking-[0.2em] text-zk-green">LIVE</span>
                </div>
              </div>
            </div>

            {/* ── Live stats strip ───────────────────────────── */}
            <div
              className="flex items-center gap-5 px-6 py-2"
              style={{
                background: "rgba(0,255,65,0.025)",
                borderBottom: "1px solid rgba(0,255,65,0.07)",
              }}
            >
              {[
                ["NODES", stats.nodes.toString()],
                ["PKT/S",  `${stats.pps}k`],
                ["LAT",   `${stats.latency}ms`],
              ].map(([k, v]) => (
                <span key={k} className="font-mono text-[9px] tracking-widest text-zk-muted">
                  {k}:{" "}
                  <motion.span
                    key={v}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-zk-green/65"
                  >
                    {v}
                  </motion.span>
                </span>
              ))}
              <span className="ml-auto font-mono text-[9px] tracking-widest text-zk-muted/45">
                ■ UPTIME 99.97%
              </span>
            </div>

            {/* ── Form body ──────────────────────────────────── */}
            <div className="px-6 pt-7 pb-7">
              <h1
                className="font-mono font-bold tracking-[0.18em] uppercase mb-1"
                style={{
                  fontSize: "1.05rem",
                  color: "#F0F6F0",
                  textShadow: "0 0 20px rgba(0,255,65,0.15)",
                }}
              >
                Establish Connection
              </h1>
              <p className="font-mono text-[11px] text-zk-muted tracking-wide mb-7">
                Enter credentials to authenticate with the network.
              </p>

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
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
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
                    border: "1px solid rgba(0,255,65,0.45)",
                    background: loading
                      ? "rgba(0,255,65,0.06)"
                      : "rgba(0,255,65,0.06)",
                    color: "#00FF41",
                    boxShadow: loading
                      ? "0 0 20px rgba(0,255,65,0.15)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = "rgba(0,255,65,0.10)";
                      e.currentTarget.style.boxShadow = "0 0 24px rgba(0,255,65,0.25)";
                      e.currentTarget.style.borderColor = "rgba(0,255,65,0.75)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0,255,65,0.06)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = "rgba(0,255,65,0.45)";
                  }}
                >
                  {/* Shimmer sweep on hover */}
                  <div
                    className="absolute inset-0 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(0,255,65,0.06) 50%, transparent 100%)",
                    }}
                  />
                  <span className="relative flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <span className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="inline-block w-1.5 h-1.5 rounded-full bg-zk-green"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 0.9, delay: i * 0.2, repeat: Infinity }}
                            />
                          ))}
                        </span>
                        <span>Handshaking...</span>
                      </>
                    ) : (
                      <>
                        <span className="opacity-50">──▶</span>
                        <span>Authenticate</span>
                        <span className="opacity-50">──▶</span>
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* Footer link */}
              <p className="mt-6 font-mono text-[10px] text-zk-muted/55 text-center tracking-wider">
                No node?{" "}
                <Link href="/signup" className="text-zk-green/70 hover:text-zk-green transition-colors duration-150">
                  Register identity
                </Link>
              </p>
            </div>
          </div>

          {/* Below-card status line */}
          <p className="mt-3 font-mono text-[9px] text-zk-muted/35 text-center tracking-[0.25em]">
            PROTOCOL: TLS 1.3 &nbsp;·&nbsp; CIPHER: AES-256-GCM &nbsp;·&nbsp; AUTH: HMAC-SHA256
          </p>
        </motion.div>
      </main>
    </>
  );
}
