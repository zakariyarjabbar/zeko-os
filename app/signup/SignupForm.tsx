// app/signup/SignupForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AuthTransition } from "@/components/ui/AuthTransition";
import {
  AuthShell, ACCENTS,
  type TelemetryLine, type TelemetryTag,
} from "@/components/ui/AuthShell";
import { AuthField, type FieldState } from "@/components/ui/AuthField";
import { type NetworkBgHandle } from "@/components/ui/NetworkBackground";

// ─── Orbit ring brand mark ────────────────────────────────────
function OrbitRing() {
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: "1px solid rgba(0,255,65,0.22)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute"
          style={{
            top: -3, left: "50%", transform: "translateX(-50%)",
            width: 6, height: 6, borderRadius: "50%",
            background: "#00FF41",
            boxShadow: "0 0 8px rgba(0,255,65,0.9), 0 0 16px rgba(0,255,65,0.4)",
          }}
        />
      </motion.div>
      <motion.div
        className="absolute rounded-full"
        style={{ inset: 8, border: "1px dashed rgba(0,255,65,0.10)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 13, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 14 }}>
        <div
          style={{
            width: "100%", height: "100%",
            border: "1px solid rgba(0,255,65,0.28)",
            background: "rgba(0,255,65,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span className="font-mono text-[9px] font-bold tracking-tight select-none" style={{ color: "#00FF41" }}>
            +//
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Validation helpers ───────────────────────────────────────
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/;

function emailLooksValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validateDisplayName(name: string): string | null {
  const t = name.trim();
  if (!t) return "Display name is required.";
  if ((t.match(/ /g) ?? []).length > 1) return "Display name may contain at most one space.";
  return null;
}

type UsernameStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";
type EmailVerifyStage = "idle" | "sending" | "sent" | "verifying" | "verified" | "error";

// Password strength — 5 buckets
interface PwScore { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string }
function scorePassword(pw: string): PwScore {
  if (!pw) return { score: 0, label: "empty", hint: "min 8 chars" };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const out: Record<0|1|2|3|4, { label: string; hint: string }> = {
    0: { label: "weak",   hint: "min 8 chars"            },
    1: { label: "weak",   hint: "add mixed case / digits" },
    2: { label: "fair",   hint: "add symbols or length"   },
    3: { label: "good",   hint: "+12 chars for strong"    },
    4: { label: "strong", hint: "locked in"               },
  };
  return { score: s as 0|1|2|3|4, ...out[s as 0|1|2|3|4] };
}

// ─── Telemetry feed ───────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────
export default function SignupForm() {
  const bgRef = useRef<NetworkBgHandle | null>(null);

  // Form fields
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [displayName,  setDisplayName]  = useState("");
  const [username,     setUsername]     = useState("");

  // Email verification
  const [evStage,            setEvStage]            = useState<EmailVerifyStage>("idle");
  const [verifyCode,         setVerifyCode]         = useState("");
  const [evError,            setEvError]            = useState<string | null>(null);
  const [evNotice,           setEvNotice]           = useState<string | null>(null);
  const [evSentAt,           setEvSentAt]           = useState<number | null>(null);
  const [evTtl,              setEvTtl]              = useState(600);
  const [evRemaining,        setEvRemaining]        = useState(0);
  const [resendAvailableAt,  setResendAvailableAt]  = useState(0);

  // Form-level
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [error,          setError]          = useState<string | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [transitioning,  setTransitioning]  = useState(false);

  const { lines, push } = useTelemetry();
  const [stats, setStats] = useState({ nodes: 847, pps: 12.4 });

  // Boot telemetry
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => push("BOOT",  "registration module v3.0 online"), 60));
    t.push(setTimeout(() => push("LINK",  "tls 1.3 channel established"),     220));
    t.push(setTimeout(() => push("CHECK", "slot pool available"),              400));
    t.push(setTimeout(() => push("OK",    "awaiting node credentials"),        600));
    return () => t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats ticker
  useEffect(() => {
    const t = setInterval(() => {
      setStats({ nodes: 840 + Math.floor(Math.random() * 22), pps: +(10.8 + Math.random() * 3.2).toFixed(1) });
    }, 2700);
    return () => clearInterval(t);
  }, []);

  // Countdown for code expiry
  useEffect(() => {
    if (!evSentAt || evStage === "verified") return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((evSentAt + evTtl * 1000 - Date.now()) / 1000));
      setEvRemaining(s);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [evSentAt, evTtl, evStage]);

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

  // ── Username debounce ────────────────────────────────────────
  const handleUsernameChange = useCallback((v: string) => {
    setUsername(v.toLowerCase().replace(/[^a-z0-9._-]/g, ""));
  }, []);

  useEffect(() => {
    if (!username) { setUsernameStatus("idle"); return; }
    if (!USERNAME_RE.test(username)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/username-available?username=${encodeURIComponent(username)}`, { signal: controller.signal });
        const data: { available: boolean; reason?: string } = await res.json();
        if (controller.signal.aborted) return;
        if (data.available) { setUsernameStatus("available"); push("OK", `username "${username}" available`); }
        else if (data.reason === "taken") { setUsernameStatus("taken"); push("WARN", `username "${username}" taken`); }
        else if (data.reason === "format") setUsernameStatus("invalid");
        else setUsernameStatus("error");
      } catch (err) {
        if (!controller.signal.aborted) { setUsernameStatus("error"); void err; }
      }
    }, 350);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [username, push]);

  // ── Derived states ───────────────────────────────────────────
  const pw = useMemo(() => scorePassword(password), [password]);

  const emailState: FieldState = useMemo(() => {
    if (evStage === "verified") return "valid";
    if (!email) return "idle";
    return emailLooksValid(email) ? "valid" : "warn";
  }, [email, evStage]);

  const passwordState: FieldState = useMemo(() => {
    if (!password) return "idle";
    if (password.length < 8) return "warn";
    return pw.score >= 3 ? "valid" : "warn";
  }, [password, pw.score]);

  const nameState: FieldState = useMemo(() => {
    if (!displayName) return "idle";
    return validateDisplayName(displayName) ? "warn" : "valid";
  }, [displayName]);

  const usernameState: FieldState = useMemo(() => {
    switch (usernameStatus) {
      case "available": return "valid";
      case "taken": case "invalid": case "error": return "warn";
      default: return "idle";
    }
  }, [usernameStatus]);

  const usernameStatusLabel = useMemo(() => {
    switch (usernameStatus) {
      case "checking":  return "CHECKING…";
      case "available": return "AVAILABLE";
      case "taken":     return "TAKEN";
      case "invalid":   return "FMT?";
      case "error":     return "ERR";
      default:          return undefined;
    }
  }, [usernameStatus]);

  const codeState: FieldState = useMemo(() => {
    if (!verifyCode) return "idle";
    if (evRemaining === 0) return "error";
    return verifyCode.length >= 8 ? "valid" : "warn";
  }, [verifyCode, evRemaining]);

  const emailLocked = evStage !== "idle" && evStage !== "error";
  const canSendCode = emailLooksValid(email) && evStage === "idle";
  const canRegister = evStage === "verified" && !loading;
  const resendCooldown = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));

  // ── Send Code ────────────────────────────────────────────────
  async function handleSendCode() {
    if (!emailLooksValid(email)) return;
    setEvError(null);
    setEvNotice(null);
    setEvStage("sending");
    push("SEND", "dispatching verification code");
    try {
      const res = await fetch("/api/auth/email-verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (res.status === 429) {
        const retry = Number(data.retryInSeconds ?? 60);
        setResendAvailableAt(Date.now() + retry * 1000);
        setEvError(data.error ?? "Too many requests. Please wait.");
        setEvStage("error");
        push("WARN", `rate-limited — retry in ${retry}s`);
        return;
      }
      if (!res.ok) {
        setEvError(data.error ?? "Failed to send code.");
        setEvStage(data.verified ? "verified" : "error");
        push("ERR", "send failed");
        return;
      }
      const ttl = Math.max(60, Math.min(3600, Number(data.ttlSeconds ?? 600)));
      setEvTtl(ttl);
      setEvSentAt(Date.now());
      setResendAvailableAt(Date.now() + 60_000);
      setEvStage("sent");
      setEvNotice("Code sent — check your inbox.");
      push("OK", `verification code dispatched · ttl=${ttl}s`);
    } catch {
      setEvError("Network error. Please try again.");
      setEvStage("error");
      push("ERR", "network error");
    }
  }

  // ── Verify Code ──────────────────────────────────────────────
  async function handleVerifyCode() {
    if (verifyCode.length < 8 || evRemaining === 0) return;
    setEvError(null);
    setEvStage("verifying");
    push("SEND", "verifying code");
    try {
      const res = await fetch("/api/auth/email-verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: verifyCode }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setEvError(data.error ?? "Too many attempts. Please wait.");
        setEvStage("sent");
        push("WARN", "verify rate-limited");
        return;
      }
      if (!res.ok) {
        setEvError(data.error ?? "Invalid or expired code.");
        setEvStage(data.expired ? "idle" : "sent");
        if (data.expired) { setVerifyCode(""); setEvSentAt(null); }
        push("ERR", "code rejected");
        return;
      }
      setEvStage("verified");
      setEvError(null);
      setEvNotice(null);
      push("OK", "email verified ✓");
      bgRef.current?.ripple(window.innerWidth / 2, window.innerHeight / 2);
    } catch {
      setEvError("Network error. Please try again.");
      setEvStage("sent");
      push("ERR", "network error");
    }
  }

  // ── Resend Code ──────────────────────────────────────────────
  async function handleResend() {
    if (Date.now() < resendAvailableAt) return;
    setEvError(null);
    push("SEND", "requesting fresh code");
    try {
      const res = await fetch("/api/auth/email-verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (res.status === 429) {
        const retry = Number(data.retryInSeconds ?? 60);
        setResendAvailableAt(Date.now() + retry * 1000);
        setEvError(data.error ?? "Too many requests. Please wait.");
        push("WARN", `rate-limited — retry in ${retry}s`);
        return;
      }
      if (!res.ok) {
        setEvError(data.error ?? "Failed to resend.");
        push("ERR", "resend failed");
        return;
      }
      const ttl = Math.max(60, Math.min(3600, Number(data.ttlSeconds ?? 600)));
      setEvTtl(ttl);
      setEvSentAt(Date.now());
      setResendAvailableAt(Date.now() + 60_000);
      setVerifyCode("");
      setEvNotice("Fresh code sent.");
      push("OK", "fresh code dispatched");
    } catch {
      setEvError("Network error. Please try again.");
      push("ERR", "network error");
    }
  }

  // ── Register ─────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (evStage !== "verified") {
      setError("Please verify your email before registering.");
      return;
    }
    if (!password || !displayName.trim() || !username.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const dnErr = validateDisplayName(displayName);
    if (dnErr) { setError(dnErr); return; }
    if (!USERNAME_RE.test(username)) {
      setError("Username must be 3–20 chars: lowercase letters, numbers, dots, dashes, underscores.");
      return;
    }
    if (usernameStatus === "taken") { setError("Username is already taken."); return; }
    if (usernameStatus === "checking") { setError("Still checking username availability…"); return; }

    setLoading(true);
    push("SEND", "registration request dispatched");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:       email.trim().toLowerCase(),
          password,
          displayName: displayName.trim(),
          username:    username.trim().toLowerCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setUsernameStatus("taken");
        setError(data.error ?? "Registration failed. Please try again.");
        push("ERR", data.error?.toLowerCase() ?? "registration rejected");
        return;
      }
      push("OK", "node registered");
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
  const filledCount = [evStage === "verified" ? "✓" : "", password, displayName, username].filter(Boolean).length;

  return (
    <>
      {transitioning && (
        <AuthTransition mode="login" onComplete={() => { window.location.href = "/system/overview"; }} />
      )}

      <AuthShell
        accent="green"
        backHref="/login"
        backLabel="Back to login"
        moduleLabel="Node Registration"
        title="Register New Node"
        subtitle="Provision a new identity on the network."
        statusLabel="OPEN"
        statusSubLabel="SLOTS AVAILABLE"
        logo={<OrbitRing />}
        stats={[
          { key: "NODES",  value: stats.nodes.toString() },
          { key: "PKT/S",  value: `${stats.pps}k` },
          { key: "STATUS", value: "NOMINAL" },
        ]}
        uptime="99.97%"
        telemetryTitle="REGISTRATION STREAM"
        telemetry={lines}
        bgRef={bgRef}
        shortcutHint={`⏎ SUBMIT · ${filledCount}/4 FIELDS`}
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* ── Email + Send Code ─────────────────────────────── */}
          <div className="space-y-2">
            <AuthField
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(v) => {
                if (!emailLocked) {
                  setEmail(v);
                }
              }}
              accent={accent}
              placeholder="user@zeko.net"
              disabled={loading || emailLocked}
              autoFocus={!emailLocked}
              autoComplete="email"
              state={emailState}
              statusLabel={
                evStage === "verified" ? "VERIFIED"
                : evStage === "sending" ? "SENDING…"
                : evStage === "sent" || evStage === "verifying" ? "CODE SENT"
                : emailState === "warn" ? "FMT?"
                : undefined
              }
              onType={() => { triggerRipple(); emitType("email", email.length + 1); }}
              onFieldFocus={(id) => push("FIELD", `${id} focused`)}
            />

            {/* Send Code button — shown when idle or error */}
            {(evStage === "idle" || evStage === "error") && (
              <button
                type="button"
                onClick={handleSendCode}
                disabled={!canSendCode}
                className="w-full font-mono text-[11px] tracking-[0.18em] uppercase py-2 px-4 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  border:     "1px solid rgba(0,255,65,0.30)",
                  background: "rgba(0,255,65,0.04)",
                  color:      "#00FF41",
                }}
                onMouseEnter={(e) => {
                  if (!canSendCode) return;
                  e.currentTarget.style.background  = "rgba(0,255,65,0.08)";
                  e.currentTarget.style.borderColor = "rgba(0,255,65,0.55)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background  = "rgba(0,255,65,0.04)";
                  e.currentTarget.style.borderColor = "rgba(0,255,65,0.30)";
                }}
              >
                Send Verification Code
              </button>
            )}

            {/* Code entry — shown when code has been sent */}
            {(evStage === "sent" || evStage === "verifying") && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <AuthField
                  id="verifyCode"
                  label="Verification Code"
                  hint={evRemaining > 0 ? `expires in ${evRemaining}s` : "expired"}
                  type="text"
                  value={verifyCode}
                  onChange={(v) => setVerifyCode(v.replace(/\D/g, "").slice(0, 8))}
                  accent={accent}
                  placeholder="00000000"
                  disabled={loading || evStage === "verifying" || evRemaining === 0}
                  autoFocus
                  autoComplete="one-time-code"
                  state={codeState}
                  statusLabel={
                    evRemaining === 0         ? "EXPIRED"
                    : evStage === "verifying" ? "CHECKING…"
                    : verifyCode.length >= 8  ? "READY"
                    : verifyCode.length > 0   ? `${verifyCode.length}/8`
                    : undefined
                  }
                  onType={() => { triggerRipple(); emitType("code", verifyCode.length + 1); }}
                  onFieldFocus={(id) => push("FIELD", `${id} focused`)}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={verifyCode.length < 6 || evRemaining === 0 || evStage === "verifying"}
                    className="flex-1 font-mono text-[11px] tracking-[0.18em] uppercase py-2 px-4 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      border:     "1px solid rgba(0,255,65,0.45)",
                      background: "rgba(0,255,65,0.06)",
                      color:      "#00FF41",
                    }}
                    onMouseEnter={(e) => {
                      if (verifyCode.length < 6 || evRemaining === 0) return;
                      e.currentTarget.style.background  = "rgba(0,255,65,0.10)";
                      e.currentTarget.style.borderColor = "rgba(0,255,65,0.75)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background  = "rgba(0,255,65,0.06)";
                      e.currentTarget.style.borderColor = "rgba(0,255,65,0.45)";
                    }}
                  >
                    {evStage === "verifying" ? "Verifying…" : "Verify ──▶"}
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="font-mono text-[10px] tracking-wider text-zk-muted/55 hover:text-zk-green/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Verified badge */}
            {evStage === "verified" && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between px-3 py-2"
                style={{
                  border:     "1px solid rgba(0,255,65,0.30)",
                  background: "rgba(0,255,65,0.06)",
                }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-zk-green shrink-0" />
                  <span className="font-mono text-[11px] text-zk-green">Email verified</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEvStage("idle");
                    setEvError(null);
                    setEvNotice(null);
                    setVerifyCode("");
                    setEvSentAt(null);
                    setEmail("");
                    push("WARN", "email verification reset");
                  }}
                  className="font-mono text-[10px] text-zk-muted/55 hover:text-zk-green/80 transition-colors tracking-wider"
                >
                  change
                </button>
              </motion.div>
            )}

            {/* Email verify notice / error */}
            {evNotice && !evError && evStage !== "verified" && (
              <p className="font-mono text-[10px] text-zk-green/70 tracking-wider">{evNotice}</p>
            )}
            {evError && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 px-3 py-2"
                style={{ border: "1px solid rgba(255,59,59,0.20)", background: "rgba(255,59,59,0.04)" }}
              >
                <AlertTriangle size={11} className="text-zk-red shrink-0 mt-0.5" />
                <span className="font-mono text-[10px] text-zk-red">{evError}</span>
              </motion.div>
            )}
          </div>

          {/* ── Username ─────────────────────────────────────── */}
          <AuthField
            id="username"
            label="Username"
            hint="3–20 chars · a-z 0-9 . _ -"
            type="text"
            value={username}
            onChange={handleUsernameChange}
            accent={accent}
            placeholder="node_operator"
            disabled={loading}
            autoComplete="username"
            state={usernameState}
            statusLabel={usernameStatusLabel}
            onType={() => { triggerRipple(); emitType("username", username.length + 1); }}
            onFieldFocus={(id) => push("FIELD", `${id} focused`)}
          />

          {/* ── Password ──────────────────────────────────────── */}
          <div>
            <AuthField
              id="password"
              label="Password"
              hint="min 8 chars"
              type="password"
              value={password}
              onChange={setPassword}
              accent={accent}
              placeholder="••••••••"
              disabled={loading}
              autoComplete="new-password"
              state={passwordState}
              statusLabel={password ? pw.label.toUpperCase() : undefined}
              onType={() => { triggerRipple(); emitType("password", password.length + 1); }}
              onFieldFocus={(id) => push("FIELD", `${id} focused`)}
              onCapsLockChange={(on) => { if (on) push("WARN", "caps_lock detected"); }}
            />
            <StrengthMeter score={pw.score} hint={pw.hint} />
          </div>

          {/* ── Display Name ──────────────────────────────────── */}
          <AuthField
            id="displayName"
            label="Display Name"
            hint="one space allowed"
            type="text"
            value={displayName}
            onChange={setDisplayName}
            accent={accent}
            placeholder="John Doe"
            disabled={loading}
            autoComplete="name"
            state={nameState}
            onType={() => { triggerRipple(); emitType("display", displayName.length + 1); }}
            onFieldFocus={(id) => push("FIELD", `${id} focused`)}
          />

          {/* Form-level error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2 px-3 py-2.5"
              style={{ border: "1px solid rgba(255,59,59,0.25)", background: "rgba(255,59,59,0.05)" }}
            >
              <AlertTriangle size={12} className="text-zk-red shrink-0 mt-0.5" />
              <span className="font-mono text-[11px] text-zk-red">{error}</span>
            </motion.div>
          )}

          {/* Register button */}
          <button
            type="submit"
            disabled={!canRegister}
            className="relative w-full overflow-hidden font-mono text-sm tracking-[0.18em] uppercase py-3 px-6 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            style={{
              border:     "1px solid rgba(0,255,65,0.45)",
              background: "rgba(0,255,65,0.06)",
              color:      "#00FF41",
              boxShadow:  loading ? "0 0 20px rgba(0,255,65,0.15)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!canRegister) return;
              e.currentTarget.style.background  = "rgba(0,255,65,0.10)";
              e.currentTarget.style.boxShadow   = "0 0 24px rgba(0,255,65,0.25)";
              e.currentTarget.style.borderColor = "rgba(0,255,65,0.75)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background  = "rgba(0,255,65,0.06)";
              e.currentTarget.style.boxShadow   = "none";
              e.currentTarget.style.borderColor = "rgba(0,255,65,0.45)";
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-700"
              style={{ background: "linear-gradient(90deg, transparent 0%, rgba(0,255,65,0.06) 50%, transparent 100%)" }}
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
                  <span>Provisioning...</span>
                </>
              ) : evStage !== "verified" ? (
                <>
                  <span className="opacity-40">──▶</span>
                  <span className="opacity-60">Verify email to register</span>
                  <span className="opacity-40">──▶</span>
                </>
              ) : (
                <>
                  <span className="opacity-50">──▶</span>
                  <span>Register</span>
                  <span className="opacity-50">──▶</span>
                </>
              )}
            </span>
          </button>
        </form>

        <p className="mt-6 font-mono text-[10px] text-zk-muted/55 text-center tracking-wider">
          Already have one?{" "}
          <Link href="/login" className="text-zk-green/70 hover:text-zk-green transition-colors duration-150">
            Connect to it
          </Link>
        </p>
      </AuthShell>
    </>
  );
}

// ─── Strength meter ───────────────────────────────────────────
function StrengthMeter({ score, hint }: { score: 0 | 1 | 2 | 3 | 4; hint: string }) {
  const labelColor =
    score >= 4 ? "#00FF41" : score === 3 ? "rgba(0,255,65,0.75)" : score === 2 ? "#FFB800"
    : score >= 1 ? "rgba(255,184,0,0.75)" : "rgba(107,122,107,0.7)";

  const barColors = [
    "rgba(255,59,59,0.75)",
    "rgba(255,184,0,0.8)",
    "rgba(0,255,65,0.6)",
    "#00FF41",
  ];

  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="flex items-center gap-1 flex-1">
        {[0, 1, 2, 3].map((i) => {
          const active = i < score;
          return (
            <motion.div
              key={i}
              className="h-[3px] flex-1"
              initial={false}
              animate={{
                background: active ? barColors[Math.min(score - 1, 3)] : "rgba(0,255,65,0.08)",
                boxShadow:  active ? `0 0 6px ${barColors[Math.min(score - 1, 3)]}50` : "none",
              }}
              transition={{ duration: 0.2 }}
            />
          );
        })}
      </div>
      <span className="font-mono text-[9px] tracking-widest uppercase shrink-0" style={{ color: labelColor }}>
        {hint}
      </span>
    </div>
  );
}
