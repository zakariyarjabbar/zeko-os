// app/verify-email/VerifyEmailForm.tsx
// Step 2 of signup: enter the 6-digit OTP that Supabase emailed.
// Mirrors the code-entry stage of ResetPasswordForm.

"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState, type FormEvent,
} from "react";
import { motion }                     from "framer-motion";
import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import Link                           from "next/link";
import {
  AuthShell, ACCENTS,
  type TelemetryLine, type TelemetryTag,
} from "@/components/ui/AuthShell";
import { AuthField, type FieldState } from "@/components/ui/AuthField";
import { type NetworkBgHandle }       from "@/components/ui/NetworkBackground";
import { AuthTransition }             from "@/components/ui/AuthTransition";

const VERIFY_TTL_SECONDS = 600; // must match server constant

// ─── Brand mark ───────────────────────────────────────────────
function OrbitRing() {
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: "1px solid rgba(0,255,65,0.22)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
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
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
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
          <Mail size={12} style={{ color: "#00FF41" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Telemetry hook ───────────────────────────────────────────
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

type Stage = "verify" | "done";

export default function VerifyEmailForm() {
  const bgRef = useRef<NetworkBgHandle | null>(null);

  const [email,     setEmail]     = useState("");
  const [code,      setCode]      = useState("");
  const [stage,     setStage]     = useState<Stage>("verify");
  const [error,     setError]     = useState<string | null>(null);
  const [notice,    setNotice]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Countdown — starts when the page mounts (code was sent at signup time)
  const [issuedAt,  setIssuedAt]  = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(VERIFY_TTL_SECONDS);

  // Resend cooldown
  const [resendAvailableAt, setResendAvailableAt] = useState<number>(
    () => Date.now() + 60_000  // initial 60s cooldown from the first send
  );

  const { lines, push } = useTelemetry();
  const [stats, setStats] = useState({ nodes: 847, pps: 12.4 });

  // ── Read email from query param ─────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("email") ?? "";
    if (q) {
      setEmail(q);
      setIssuedAt(Date.now()); // treat page load as t=0 for the countdown
    }
  }, []);

  // ── Boot telemetry ──────────────────────────────────────────
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => push("BOOT",  "verification module v1.0 online"),  60));
    t.push(setTimeout(() => push("LINK",  "tls 1.3 channel established"),      220));
    t.push(setTimeout(() => push("CHECK", "awaiting one-time code"),           420));
    return () => t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stats ticker ────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setStats({
        nodes: 840 + Math.floor(Math.random() * 22),
        pps:   +(10.8 + Math.random() * 3.2).toFixed(1),
      });
    }, 2700);
    return () => clearInterval(t);
  }, []);

  // ── Countdown ───────────────────────────────────────────────
  useEffect(() => {
    if (!issuedAt) return;
    const tick = () => {
      const secs = Math.max(0, Math.ceil((issuedAt + VERIFY_TTL_SECONDS * 1000 - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [issuedAt]);

  const triggerRipple = useCallback(() => {
    bgRef.current?.ripple(window.innerWidth / 2, window.innerHeight / 2);
  }, []);

  const lastTypeEmit = useRef<Record<string, number>>({});
  const emitType = useCallback((fieldId: string, bytes: number) => {
    const now = Date.now();
    if (now - (lastTypeEmit.current[fieldId] ?? 0) < 500) return;
    lastTypeEmit.current[fieldId] = now;
    push("INPUT", `${fieldId} ${bytes}B`);
  }, [push]);

  const handleCodeChange = useCallback((v: string) => {
    setCode(v.replace(/\D/g, "").slice(0, 8));
  }, []);

  // ── Derived states ───────────────────────────────────────────
  const codeState: FieldState = useMemo(() => {
    if (!code) return "idle";
    if (remaining === 0) return "error";
    if (code.length < 6) return "warn";
    return "valid";
  }, [code, remaining]);

  // ── Submit ──────────────────────────────────────────────────
  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email) {
      setError("Email address missing. Please return to signup.");
      return;
    }
    if (code.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (remaining === 0) {
      setError("Code expired. Request a new one below.");
      return;
    }

    setLoading(true);
    push("SEND", "verifying code");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, code }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Too many attempts. Please wait.");
        push("WARN", "rate-limited");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        if (data.expired) {
          // Redirect to signup so they can start over
          setError(data.error ?? "Code expired. Please sign up again.");
          push("ERR", "code expired — redirect to signup");
          setTimeout(() => { window.location.href = "/signup"; }, 2500);
          return;
        }
        setError(data.error ?? "Invalid or expired code.");
        push("ERR", "code rejected");
        return;
      }

      push("OK", "email verified — session active");
      bgRef.current?.burst();
      setStage("done");
      setTransitioning(true);
    } catch {
      setError("Network error. Please try again.");
      push("ERR", "network error");
    } finally {
      setLoading(false);
    }
  }

  // ── Resend ──────────────────────────────────────────────────
  async function handleResend() {
    if (Date.now() < resendAvailableAt || resending || !email) return;
    setError(null);
    setNotice(null);
    setResending(true);
    push("SEND", "requesting fresh code");
    try {
      const res = await fetch("/api/auth/verify-email/resend", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const retry = Number(data.retryInSeconds ?? 60);
        setResendAvailableAt(Date.now() + retry * 1000);
        setError(data.error ?? "Too many requests. Please wait.");
        push("WARN", `rate-limited — retry in ${retry}s`);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        if (data.expired) {
          setError(data.error ?? "Verification expired. Please sign up again.");
          setTimeout(() => { window.location.href = "/signup"; }, 2500);
          return;
        }
        setError(data.error ?? "Failed to resend code.");
        push("ERR", "resend failed");
        return;
      }

      setIssuedAt(Date.now());
      setResendAvailableAt(Date.now() + 60_000);
      setCode("");
      setNotice("A fresh code is on its way.");
      push("OK", "fresh code dispatched");
    } catch {
      setError("Network error. Please try again.");
      push("ERR", "network error");
    } finally {
      setResending(false);
    }
  }

  const resendCooldown = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
  const accent = ACCENTS.green;

  const statusSubLabel =
    stage === "done"    ? "SESSION ACTIVE"
    : remaining > 0     ? `CODE EXPIRES IN ${remaining}s`
    : "CODE EXPIRED";

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
        backHref="/signup"
        backLabel="Back to signup"
        moduleLabel="Email Verification"
        title="Verify Your Email"
        subtitle={
          stage === "done"
            ? "Email confirmed — connecting you to the network."
            : "Enter the 6-digit code from your email to complete registration."
        }
        statusLabel={stage === "done" ? "DONE" : remaining > 0 ? "PENDING" : "EXPIRED"}
        statusSubLabel={statusSubLabel}
        logo={<OrbitRing />}
        stats={[
          { key: "NODES",  value: stats.nodes.toString() },
          { key: "PKT/S",  value: `${stats.pps}k` },
          { key: "STATUS", value: "NOMINAL" },
        ]}
        uptime="99.97%"
        telemetryTitle="VERIFICATION STREAM"
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
              border:     "1px solid rgba(0,255,65,0.30)",
              background: "rgba(0,255,65,0.06)",
            }}
          >
            <CheckCircle2 size={14} className="text-zk-green shrink-0 mt-0.5" />
            <span className="font-mono text-[11px] text-zk-green">
              Verified. Redirecting…
            </span>
          </motion.div>
        ) : (
          <form onSubmit={handleVerify} noValidate className="space-y-5">
            {/* Email (read-only indicator) */}
            {email && (
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-zk-muted">
                  Target
                </span>
                <div
                  className="flex items-center justify-between px-4 py-2.5 font-mono text-[12px] text-zk-white/85"
                  style={{
                    border:     "1px solid rgba(0,255,65,0.12)",
                    background: "rgba(0,0,0,0.38)",
                  }}
                >
                  <span className="truncate">{email}</span>
                  <Link
                    href="/signup"
                    className="font-mono text-[10px] text-zk-muted hover:text-zk-green/80 tracking-wider shrink-0 ml-3"
                  >
                    change
                  </Link>
                </div>
              </div>
            )}

            <AuthField
              id="code"
              label="One-time Code"
              hint={
                remaining > 0
                  ? `expires in ${remaining}s`
                  : "expired — request a new code below"
              }
              type="text"
              value={code}
              onChange={handleCodeChange}
              accent={accent}
              placeholder="000000"
              disabled={loading || remaining === 0}
              autoFocus
              autoComplete="one-time-code"
              state={codeState}
              statusLabel={
                remaining === 0   ? "EXPIRED"
                : code.length >= 6 ? "READY"
                : code.length > 0  ? `${code.length}/6`
                : undefined
              }
              onType={() => { triggerRipple(); emitType("code", code.length); }}
              onFieldFocus={(id) => push("FIELD", `${id} focused`)}
            />

            {notice && !error && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 px-3 py-2.5"
                style={{
                  border:     "1px solid rgba(0,255,65,0.25)",
                  background: "rgba(0,255,65,0.04)",
                }}
              >
                <span className="font-mono text-[11px] text-zk-green/90">{notice}</span>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 px-3 py-2.5"
                style={{
                  border:     "1px solid rgba(255,59,59,0.25)",
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
              disabled={loading || remaining === 0}
              className="relative w-full overflow-hidden font-mono text-sm tracking-[0.18em] uppercase py-3 px-6 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              style={{
                border:     "1px solid rgba(0,255,65,0.45)",
                background: "rgba(0,255,65,0.06)",
                color:      "#00FF41",
                boxShadow:  loading ? "0 0 20px rgba(0,255,65,0.15)" : "none",
              }}
              onMouseEnter={(e) => {
                if (loading || remaining === 0) return;
                e.currentTarget.style.background   = "rgba(0,255,65,0.10)";
                e.currentTarget.style.boxShadow    = "0 0 24px rgba(0,255,65,0.25)";
                e.currentTarget.style.borderColor  = "rgba(0,255,65,0.75)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background   = "rgba(0,255,65,0.06)";
                e.currentTarget.style.boxShadow    = "none";
                e.currentTarget.style.borderColor  = "rgba(0,255,65,0.45)";
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
                    <span>Verifying…</span>
                  </>
                ) : (
                  <>
                    <span className="opacity-50">──▶</span>
                    <span>Verify Email</span>
                    <span className="opacity-50">──▶</span>
                  </>
                )}
              </span>
            </button>

            {/* Resend row */}
            <div className="flex items-center justify-between font-mono text-[10px] tracking-wider">
              <span className="text-zk-muted/55">Didn&apos;t get it?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0 || !email}
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
    </>
  );
}
