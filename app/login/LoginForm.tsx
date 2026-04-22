// app/login/LoginForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthTransition } from "@/components/ui/AuthTransition";
import {
  AuthShell, ACCENTS,
  type TelemetryLine, type TelemetryTag,
} from "@/components/ui/AuthShell";
import { AuthField, type FieldState } from "@/components/ui/AuthField";
import { type NetworkBgHandle } from "@/components/ui/NetworkBackground";

// ─── Orbit ring (login-only brand mark) ───────────────────────
function OrbitRing() {
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
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
      <motion.div
        className="absolute rounded-full"
        style={{ inset: 8, border: "1px dashed rgba(0,255,65,0.10)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 14 }}>
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

// ─── Email heuristic (pure display — server is authoritative) ──
function emailLooksValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// ─── Telemetry feed hook ──────────────────────────────────────
function useTelemetry() {
  const [mountedAt] = useState(() => Date.now());
  const idRef     = useRef(1);
  const [lines, setLines] = useState<TelemetryLine[]>([]);

  const push = useCallback((tag: TelemetryTag, msg: string) => {
    const ts = (Date.now() - mountedAt) / 1000;
    setLines((prev) => {
      const next = [...prev, { id: idRef.current++, ts, tag, msg }];
      return next.length > 18 ? next.slice(next.length - 18) : next;
    });
  }, [mountedAt]);

  return { lines, push };
}

// ─── Component ────────────────────────────────────────────────
export default function LoginForm() {
  const bgRef = useRef<NetworkBgHandle | null>(null);

  const router = useRouter();

  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [persistSession, setPersistSession] = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [transitioning,  setTransitioning]  = useState(false);

  const { lines, push } = useTelemetry();

  // Decorative live stats
  const [stats, setStats] = useState({ nodes: 847, pps: 12.4, latency: "<1" });

  // ── Boot sequence ────────────────────────────────────────────
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => push("BOOT",  "auth module v2.4.1 online"),  60));
    t.push(setTimeout(() => push("LINK",  "tls 1.3 channel established"), 220));
    t.push(setTimeout(() => push("CHECK", "network link nominal"),        420));
    t.push(setTimeout(() => push("OK",    "awaiting credentials"),        600));
    return () => t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats tick
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

  // Keystroke ripple (on every keypress)
  const triggerRipple = useCallback(() => {
    bgRef.current?.ripple(window.innerWidth / 2, window.innerHeight / 2);
  }, []);

  // Throttled INPUT telemetry (1 emit / 500ms / field)
  const lastTypeEmit = useRef<Record<string, number>>({});
  const emitType = useCallback(
    (fieldId: string, bytes: number) => {
      const now = Date.now();
      if (now - (lastTypeEmit.current[fieldId] ?? 0) < 500) return;
      lastTypeEmit.current[fieldId] = now;
      push("INPUT", `${fieldId} ${bytes}B`);
    },
    [push]
  );

  // Submit shortcut hint
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement instanceof HTMLInputElement) {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Derived field states
  const emailState: FieldState = useMemo(() => {
    if (!email) return "idle";
    return emailLooksValid(email) ? "valid" : "warn";
  }, [email]);
  const passwordState: FieldState = password.length > 0 ? "valid" : "idle";

  // ── Navigate to /reset-password, pre-filling email if valid ──
  function handleResetNav() {
    push("CHECK", "navigating to recovery");
    const addr = email.trim();
    const qs = addr && emailLooksValid(addr)
      ? `?email=${encodeURIComponent(addr)}`
      : "";
    router.push(`/reset-password${qs}`);
  }

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Both fields are required.");
      push("ERR", "missing credentials");
      return;
    }

    setLoading(true);
    push("SEND", "auth request dispatched");
    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), password, persistSession }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Authentication failed.");
        push("ERR", data.error?.toLowerCase() ?? "auth rejected");
        return;
      }
      push("OK", "session established");
      bgRef.current?.burst();
      setTransitioning(true);
    } catch {
      setError("Network error. Please try again.");
      push("ERR", "network error");
    } finally {
      setLoading(false);
    }
  }

  const accent = ACCENTS.green;

  return (
    <>
      {transitioning && (
        <AuthTransition
          mode="login"
          onComplete={() => { window.location.href = "/system/overview"; }}
        />
      )}

      <AuthShell
        accent="green"
        backHref="/"
        backLabel="Back"
        moduleLabel="Authentication Module"
        title="Establish Connection"
        subtitle="Enter credentials to authenticate with the network."
        statusLabel="LIVE"
        statusSubLabel="CHANNEL OPEN"
        logo={<OrbitRing />}
        stats={[
          { key: "NODES", value: stats.nodes.toString() },
          { key: "PKT/S", value: `${stats.pps}k` },
          { key: "LAT",   value: `${stats.latency}ms` },
        ]}
        uptime="99.97%"
        telemetryTitle="AUTH EVENT STREAM"
        telemetry={lines}
        bgRef={bgRef}
        shortcutHint="⏎ SUBMIT · ESC BLUR"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <AuthField
            id="email"
            label="Email Endpoint"
            type="email"
            value={email}
            onChange={setEmail}
            accent={accent}
            placeholder="user@zeko.net"
            disabled={loading}
            autoFocus
            autoComplete="email"
            state={emailState}
            statusLabel={emailState === "warn" ? "FMT?" : undefined}
            onType={() => { triggerRipple(); emitType("email", email.length + 1); }}
            onFieldFocus={(id) => push("FIELD", `${id} focused`)}
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            accent={accent}
            placeholder="••••••••"
            disabled={loading}
            autoComplete="current-password"
            state={passwordState}
            onType={() => { triggerRipple(); emitType("password", password.length + 1); }}
            onFieldFocus={(id) => push("FIELD", `${id} focused`)}
            onCapsLockChange={(on) => {
              if (on) push("WARN", "caps_lock detected");
            }}
          />

          {/* Helpers row */}
          <div className="flex items-center justify-between font-mono text-[10px] tracking-wider">
            <label
              className={`inline-flex items-center gap-2 cursor-pointer group select-none transition-colors ${
                persistSession ? "text-zk-green/80" : "text-zk-muted/70"
              }`}
            >
              <input
                type="checkbox"
                checked={persistSession}
                disabled={loading}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPersistSession(on);
                  push("CHECK", `remember me ${on ? "on (30d)" : "off (8h)"}`);
                }}
                className="sr-only"
              />
              <span
                className="w-3 h-3 border flex items-center justify-center transition-colors"
                style={{
                  borderColor: persistSession ? "rgba(0,255,65,0.75)" : "rgba(0,255,65,0.35)",
                  background:  persistSession ? "rgba(0,255,65,0.12)" : "rgba(0,0,0,0.4)",
                }}
              >
                <span
                  className={`w-1.5 h-1.5 bg-zk-green transition-opacity ${
                    persistSession ? "opacity-100" : "opacity-0 group-hover:opacity-30"
                  }`}
                />
              </span>
              <span className="group-hover:text-zk-green/70 transition-colors">
                Remember me
              </span>
            </label>
            <button
              type="button"
              onClick={handleResetNav}
              disabled={loading}
              className="text-zk-muted/55 hover:text-zk-green/70 transition-colors tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset password
            </button>
          </div>

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
              background: "rgba(0,255,65,0.06)",
              color: "#00FF41",
              boxShadow: loading ? "0 0 20px rgba(0,255,65,0.15)" : "none",
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
          No account?{" "}
          <Link
            href="/signup"
            className="text-zk-green/70 hover:text-zk-green transition-colors duration-150"
          >
            Register one
          </Link>
        </p>
      </AuthShell>
    </>
  );
}
