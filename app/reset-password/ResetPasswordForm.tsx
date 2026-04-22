// app/reset-password/ResetPasswordForm.tsx
// Two-step OTP reset flow:
//   Step 1 — enter email → server issues 6-digit code via Supabase OTP email
//   Step 2 — enter code + new password → server verifies + updates + signs in
//
// Server enforces:
//   · 2-minute expiry (mirrored here as a visible countdown)
//   · per-email / per-IP rate limits   (surfaced as 429 with Retry-After)
//   · 5-attempt cap per code          (we show a neutral "expired" message)

"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState, type FormEvent,
} from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import {
  AuthShell, ACCENTS,
  type TelemetryLine, type TelemetryTag,
} from "@/components/ui/AuthShell";
import { AuthField, type FieldState } from "@/components/ui/AuthField";
import { type NetworkBgHandle } from "@/components/ui/NetworkBackground";

// ─── Brand mark (shared green OrbitRing) ──────────────────────
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

// ─── Email heuristic ──────────────────────────────────────────
function emailLooksValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// ─── Telemetry feed hook ──────────────────────────────────────
function useTelemetry() {
  const [mountedAt] = useState(() => Date.now());
  const idRef = useRef(1);
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

type Stage = "email" | "code" | "done";

export default function ResetPasswordForm() {
  const bgRef = useRef<NetworkBgHandle | null>(null);

  // ── State ──────────────────────────────────────────────────
  const [stage,           setStage]           = useState<Stage>("email");
  const [email,           setEmail]           = useState("");
  const [code,            setCode]            = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error,           setError]           = useState<string | null>(null);
  const [notice,          setNotice]          = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [resending,       setResending]       = useState(false);

  // Countdown: server issues a 2-minute code. Track when it was issued so we
  // can mirror that deadline in the UI and disable submit once it expires.
  const [issuedAt,  setIssuedAt]  = useState<number | null>(null);
  const [ttlSecs,   setTtlSecs]   = useState<number>(120);
  const [remaining, setRemaining] = useState<number>(0);

  // Resend cooldown — honour server Retry-After.
  const [resendAvailableAt, setResendAvailableAt] = useState<number>(0);

  const { lines, push } = useTelemetry();

  const [stats, setStats] = useState({ nodes: 847, pps: 12.4, latency: "<1" });

  // ── Prefill email from ?email= query ───────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("email") ?? "";
    if (q && emailLooksValid(q)) setEmail(q);
  }, []);

  // ── Boot telemetry ─────────────────────────────────────────
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => push("BOOT",  "recovery module v1.2 online"),  60));
    t.push(setTimeout(() => push("LINK",  "tls 1.3 channel established"),  220));
    t.push(setTimeout(() => push("CHECK", "awaiting target email"),        420));
    return () => t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stats ticker ───────────────────────────────────────────
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

  // ── Countdown loop ─────────────────────────────────────────
  useEffect(() => {
    if (!issuedAt) return;
    const tick = () => {
      const secs = Math.max(0, Math.ceil((issuedAt + ttlSecs * 1000 - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [issuedAt, ttlSecs]);

  const triggerRipple = useCallback(() => {
    bgRef.current?.ripple(window.innerWidth / 2, window.innerHeight / 2);
  }, []);

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

  // ── Derived field states ────────────────────────────────────
  const emailState: FieldState = useMemo(() => {
    if (!email) return "idle";
    return emailLooksValid(email) ? "valid" : "warn";
  }, [email]);

  const codeState: FieldState = useMemo(() => {
    if (!code) return "idle";
    if (code.length < 6) return "warn";
    if (code.length > 8) return "warn";
    return "valid";
  }, [code]);

  const passwordState: FieldState = useMemo(() => {
    if (!password) return "idle";
    if (password.length < 8) return "warn";
    return "valid";
  }, [password]);

  const confirmState: FieldState = useMemo(() => {
    if (!confirmPassword) return "idle";
    if (confirmPassword !== password) return "error";
    return "valid";
  }, [confirmPassword, password]);

  // Normalise code input to digits, max 6.
  const handleCodeChange = useCallback((v: string) => {
    setCode(v.replace(/\D/g, "").slice(0, 8));
  }, []);

  // ── Step 1: request the code ───────────────────────────────
  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const addr = email.trim().toLowerCase();
    if (!emailLooksValid(addr)) {
      setError("Enter a valid email address.");
      push("ERR", "invalid email format");
      return;
    }

    setLoading(true);
    push("SEND", "requesting recovery code");
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: addr }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const retry = Number(data.retryInSeconds ?? 60);
        setResendAvailableAt(Date.now() + retry * 1000);
        setError(data.error ?? "Too many requests. Please wait.");
        push("WARN", `rate-limited — retry in ${retry}s`);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to request recovery code.");
        push("ERR", "request rejected");
        return;
      }

      const data: { ttlSeconds?: number; message?: string } = await res.json();
      const ttl = Math.max(30, Math.min(600, Number(data.ttlSeconds ?? 120)));
      setTtlSecs(ttl);
      setIssuedAt(Date.now());
      setResendAvailableAt(Date.now() + 60_000);  // mirror server's 60s cooldown
      setStage("code");
      setNotice(data.message ?? "If that email is registered, a 6-digit code is on its way.");
      push("OK", `code dispatched · ttl=${ttl}s`);
    } catch {
      setError("Network error. Please try again.");
      push("ERR", "network error");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify code + new password ─────────────────────
  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (code.length < 6 || code.length > 8) {
      setError("Enter the code from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (remaining === 0) {
      setError("Code expired. Request a new one.");
      return;
    }

    setLoading(true);
    push("SEND", "verifying code");
    try {
      const res = await fetch("/api/auth/reset-password/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:       email.trim().toLowerCase(),
          code,
          newPassword: password,
        }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Too many attempts. Please wait.");
        push("WARN", "verify rate-limited");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Invalid or expired code.");
        push("ERR", "code rejected");
        return;
      }

      push("OK", "password updated");
      bgRef.current?.burst();
      setStage("done");
      setTimeout(() => { window.location.href = "/system/overview"; }, 900);
    } catch {
      setError("Network error. Please try again.");
      push("ERR", "network error");
    } finally {
      setLoading(false);
    }
  }

  // ── Resend code (back to step 1's endpoint, stay on step 2) ──
  async function handleResend() {
    if (Date.now() < resendAvailableAt || resending) return;
    setError(null);
    setResending(true);
    push("SEND", "requesting fresh code");
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const retry = Number(data.retryInSeconds ?? 60);
        setResendAvailableAt(Date.now() + retry * 1000);
        setError(data.error ?? "Too many requests. Please wait.");
        push("WARN", `rate-limited — retry in ${retry}s`);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to resend code.");
        return;
      }
      const data: { ttlSeconds?: number } = await res.json();
      const ttl = Math.max(30, Math.min(600, Number(data.ttlSeconds ?? 120)));
      setTtlSecs(ttl);
      setIssuedAt(Date.now());
      setResendAvailableAt(Date.now() + 60_000);
      setCode("");
      setNotice("A fresh code is on its way.");
      push("OK", "fresh code dispatched");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  }

  const accent = ACCENTS.green;

  const subtitle =
    stage === "email" ? "Enter your email to receive a 6-digit recovery code."
    : stage === "code"  ? "Check your email for the one-time code. It expires in 2 minutes."
    : "Password updated — reconnecting you to the network.";

  const statusLabel =
    stage === "email" ? "READY"
    : stage === "code"  ? "LIVE"
    : "DONE";
  const statusSubLabel =
    stage === "email" ? "AWAITING TARGET"
    : stage === "code"  ? (remaining > 0 ? `CODE EXPIRES IN ${remaining}s` : "CODE EXPIRED")
    : "SESSION ACTIVE";

  const resendCooldown = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));

  return (
    <AuthShell
      accent="green"
      backHref="/login"
      backLabel="Back to login"
      moduleLabel="Recovery Module"
      title="Reset Password"
      subtitle={subtitle}
      statusLabel={statusLabel}
      statusSubLabel={statusSubLabel}
      logo={<OrbitRing />}
      stats={[
        { key: "NODES", value: stats.nodes.toString() },
        { key: "PKT/S", value: `${stats.pps}k` },
        { key: "LAT",   value: `${stats.latency}ms` },
      ]}
      uptime="99.97%"
      telemetryTitle="RECOVERY EVENT STREAM"
      telemetry={lines}
      bgRef={bgRef}
      shortcutHint="⏎ SUBMIT · ESC BLUR"
    >
      {stage === "done" ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 px-3 py-2.5"
          style={{
            border: "1px solid rgba(0,255,65,0.30)",
            background: "rgba(0,255,65,0.06)",
          }}
        >
          <CheckCircle2 size={14} className="text-zk-green shrink-0 mt-0.5" />
          <span className="font-mono text-[11px] text-zk-green">
            Password updated. Redirecting…
          </span>
        </motion.div>
      ) : stage === "email" ? (
        <form onSubmit={handleRequest} noValidate className="space-y-5">
          <AuthField
            id="email"
            label="Email"
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

          {notice && !error && <Notice message={notice} />}
          {error && <ErrorBanner message={error} />}

          <SubmitButton loading={loading} label="Send Code" loadingLabel="Dispatching…" />

          <p className="font-mono text-[10px] text-zk-muted/55 text-center tracking-wider">
            Remembered it?{" "}
            <Link href="/login" className="text-zk-green/70 hover:text-zk-green">
              Back to login
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} noValidate className="space-y-5">
          {/* Email (read-only indicator) */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-zk-muted">
              Target
            </span>
            <div
              className="flex items-center justify-between px-4 py-2.5 font-mono text-[12px] text-zk-white/85"
              style={{
                border: "1px solid rgba(0,255,65,0.12)",
                background: "rgba(0,0,0,0.38)",
              }}
            >
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={() => {
                  setStage("email");
                  setCode(""); setPassword(""); setConfirmPassword("");
                  setIssuedAt(null); setError(null); setNotice(null);
                }}
                className="font-mono text-[10px] text-zk-muted hover:text-zk-green/80 tracking-wider shrink-0 ml-3"
              >
                change
              </button>
            </div>
          </div>

          <AuthField
            id="code"
            label="One-time Code"
            hint={remaining > 0 ? `expires in ${remaining}s` : "expired"}
            type="text"
            value={code}
            onChange={handleCodeChange}
            accent={accent}
            placeholder="00000000"
            disabled={loading || remaining === 0}
            autoFocus
            autoComplete="one-time-code"
            state={remaining === 0 ? "error" : codeState}
            statusLabel={
              remaining === 0 ? "EXPIRED"
              : code.length >= 6 ? "READY"
              : code.length > 0 ? `${code.length}/8`
              : undefined
            }
            onType={() => { triggerRipple(); emitType("code", code.length); }}
            onFieldFocus={(id) => push("FIELD", `${id} focused`)}
          />

          <AuthField
            id="password"
            label="New Password"
            type="password"
            value={password}
            onChange={setPassword}
            accent={accent}
            placeholder="••••••••"
            disabled={loading || remaining === 0}
            autoComplete="new-password"
            state={passwordState}
            statusLabel={passwordState === "warn" ? "SHORT" : undefined}
            hint={password.length > 0 ? `${password.length}/8+` : undefined}
            onType={() => { triggerRipple(); emitType("password", password.length + 1); }}
            onFieldFocus={(id) => push("FIELD", `${id} focused`)}
            onCapsLockChange={(on) => { if (on) push("WARN", "caps_lock detected"); }}
          />

          <AuthField
            id="confirm"
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            accent={accent}
            placeholder="••••••••"
            disabled={loading || remaining === 0}
            autoComplete="new-password"
            state={confirmState}
            statusLabel={confirmState === "error" ? "MISMATCH" : undefined}
            onType={() => { triggerRipple(); emitType("confirm", confirmPassword.length + 1); }}
            onFieldFocus={(id) => push("FIELD", `${id} focused`)}
          />

          {notice && !error && <Notice message={notice} />}
          {error && <ErrorBanner message={error} />}

          <SubmitButton
            loading={loading}
            disabled={remaining === 0}
            label="Set New Password"
            loadingLabel="Verifying…"
          />

          {/* Resend row */}
          <div className="flex items-center justify-between font-mono text-[10px] tracking-wider">
            <span className="text-zk-muted/55">
              Didn&apos;t get it?
            </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="text-zk-muted/55 hover:text-zk-green/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending
                ? "Sending…"
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend code"}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

// ─── Small presentational helpers ─────────────────────────────
function Notice({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 px-3 py-2.5"
      style={{
        border: "1px solid rgba(0,255,65,0.25)",
        background: "rgba(0,255,65,0.04)",
      }}
    >
      <span className="font-mono text-[11px] text-zk-green/90">{message}</span>
    </motion.div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
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
      <span className="font-mono text-[11px] text-zk-red">{message}</span>
    </motion.div>
  );
}

function SubmitButton({
  loading, disabled, label, loadingLabel,
}: {
  loading: boolean;
  disabled?: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="relative w-full overflow-hidden font-mono text-sm tracking-[0.18em] uppercase py-3 px-6 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
      style={{
        border: "1px solid rgba(0,255,65,0.45)",
        background: "rgba(0,255,65,0.06)",
        color: "#00FF41",
        boxShadow: loading ? "0 0 20px rgba(0,255,65,0.15)" : "none",
      }}
      onMouseEnter={(e) => {
        if (loading || disabled) return;
        e.currentTarget.style.background = "rgba(0,255,65,0.10)";
        e.currentTarget.style.boxShadow = "0 0 24px rgba(0,255,65,0.25)";
        e.currentTarget.style.borderColor = "rgba(0,255,65,0.75)";
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
            <span>{loadingLabel}</span>
          </>
        ) : (
          <>
            <span className="opacity-50">──▶</span>
            <span>{label}</span>
            <span className="opacity-50">──▶</span>
          </>
        )}
      </span>
    </button>
  );
}
