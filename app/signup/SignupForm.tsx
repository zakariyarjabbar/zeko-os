// app/signup/SignupForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { AuthTransition } from "@/components/ui/AuthTransition";
import {
  AuthShell, ACCENTS,
  type TelemetryLine, type TelemetryTag,
} from "@/components/ui/AuthShell";
import { AuthField, type FieldState } from "@/components/ui/AuthField";
import { type NetworkBgHandle } from "@/components/ui/NetworkBackground";

// ─── Hex brand mark (signup-only, cyan) ───────────────────────
function HexLogo() {
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: "1px solid rgba(0,212,255,0.22)" }}
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
      <motion.div
        className="absolute rounded-full"
        style={{ inset: 8, border: "1px dashed rgba(0,212,255,0.10)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 13, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 14 }}>
        <div
          style={{
            width: "100%", height: "100%",
            border: "1px solid rgba(0,212,255,0.28)",
            background: "rgba(0,212,255,0.05)",
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

// ─── Validation helpers ───────────────────────────────────────
function emailLooksValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validateDisplayName(name: string): string | null {
  const t = name.trim();
  if (!t) return "Display name is required.";
  if ((t.match(/ /g) ?? []).length > 1) return "Display name may contain at most one space.";
  return null;
}

// Password strength — 5 buckets: 0 (empty) through 4 (strong)
interface PwScore { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string }
function scorePassword(pw: string): PwScore {
  if (!pw) return { score: 0, label: "empty",  hint: "min 8 chars" };
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
export default function SignupForm() {
  const bgRef = useRef<NetworkBgHandle | null>(null);

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [displayName,   setDisplayName]   = useState("");
  const [error,         setError]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [redirectTo,    setRedirectTo]    = useState("/system/overview");

  const { lines, push } = useTelemetry();

  const [stats, setStats] = useState({ nodes: 847, pps: 12.4 });

  // Boot sequence
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => push("BOOT",  "registration module v2.4.1 online"), 60));
    t.push(setTimeout(() => push("LINK",  "tls 1.3 channel established"),       220));
    t.push(setTimeout(() => push("CHECK", "slot pool available"),                400));
    t.push(setTimeout(() => push("OK",    "awaiting node credentials"),          600));
    return () => t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Derived states ───────────────────────────────────────────
  const pw = useMemo(() => scorePassword(password), [password]);

  const emailState: FieldState = useMemo(() => {
    if (!email) return "idle";
    return emailLooksValid(email) ? "valid" : "warn";
  }, [email]);

  const passwordState: FieldState = useMemo(() => {
    if (!password) return "idle";
    if (password.length < 8) return "warn";
    return pw.score >= 3 ? "valid" : "warn";
  }, [password, pw.score]);

  const nameState: FieldState = useMemo(() => {
    if (!displayName) return "idle";
    return validateDisplayName(displayName) ? "warn" : "valid";
  }, [displayName]);

  // Log strength transitions (not every keystroke)
  const lastPwLabel = useRef<string>("empty");
  useEffect(() => {
    if (pw.label !== lastPwLabel.current) {
      lastPwLabel.current = pw.label;
      push("CHECK", `password strength=${pw.label}`);
    }
  }, [pw.label, push]);

  const filledCount = [email, password, displayName].filter(Boolean).length;

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password || !displayName.trim()) {
      setError("All fields are required.");
      push("ERR", "missing fields");
      return;
    }
    if (password.length < 8) {
      setError("Access token must be at least 8 characters.");
      push("ERR", "password too short");
      return;
    }
    const dnErr = validateDisplayName(displayName);
    if (dnErr) {
      setError(dnErr);
      push("ERR", "display name invalid");
      return;
    }

    setLoading(true);
    push("SEND", "registration request dispatched");
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
        push("ERR", data.error?.toLowerCase() ?? "registration rejected");
        return;
      }
      push("OK", "node registered");
      bgRef.current?.burst();
      setRedirectTo(data.redirect ?? "/system/overview");
      setTransitioning(true);
    } catch {
      setError("Network error. Please try again.");
      push("ERR", "network error");
    } finally {
      setLoading(false);
    }
  }

  const accent = ACCENTS.cyan;

  return (
    <>
      {transitioning && (
        <AuthTransition mode="login" onComplete={() => { window.location.href = redirectTo; }} />
      )}

      <AuthShell
        accent="cyan"
        backHref="/login"
        backLabel="Back to login"
        moduleLabel="Node Registration"
        title="Register New Node"
        subtitle="Provision a new identity on the network."
        statusLabel="OPEN"
        statusSubLabel="SLOTS AVAILABLE"
        logo={<HexLogo />}
        stats={[
          { key: "NODES",  value: stats.nodes.toString() },
          { key: "PKT/S",  value: `${stats.pps}k` },
          { key: "STATUS", value: "NOMINAL" },
        ]}
        uptime="99.97%"
        telemetryTitle="REGISTRATION STREAM"
        telemetry={lines}
        bgRef={bgRef}
        shortcutHint={`⏎ SUBMIT · ${filledCount}/3 FIELDS`}
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

          <div>
            <AuthField
              id="password"
              label="Access Token"
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
              onCapsLockChange={(on) => {
                if (on) push("WARN", "caps_lock detected");
              }}
            />
            <StrengthMeter score={pw.score} hint={pw.hint} />
          </div>

          <AuthField
            id="displayName"
            label="Node Alias"
            hint="one space allowed"
            type="text"
            value={displayName}
            onChange={setDisplayName}
            accent={accent}
            placeholder="John Doe"
            disabled={loading}
            autoComplete="off"
            state={nameState}
            onType={() => { triggerRipple(); emitType("alias", displayName.length + 1); }}
            onFieldFocus={(id) => push("FIELD", `${id} focused`)}
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

        <p className="mt-6 font-mono text-[10px] text-zk-muted/55 text-center tracking-wider">
          Already registered?{" "}
          <Link
            href="/login"
            className="hover:text-zk-green transition-colors duration-150"
            style={{ color: "rgba(0,212,255,0.65)" }}
          >
            Connect to node
          </Link>
        </p>
      </AuthShell>
    </>
  );
}

// ─── Strength meter ───────────────────────────────────────────
function StrengthMeter({ score, hint }: { score: 0 | 1 | 2 | 3 | 4; hint: string }) {
  const labelColor =
      score >= 4 ? "#00FF41"
    : score === 3 ? "#00D4FF"
    : score === 2 ? "#FFB800"
    : score >= 1 ? "rgba(255,184,0,0.75)"
    : "rgba(107,122,107,0.7)";

  const barColors = [
    "rgba(255,59,59,0.75)",   // 1 — weak
    "rgba(255,184,0,0.8)",    // 2 — fair
    "rgba(0,212,255,0.8)",    // 3 — good
    "#00FF41",                // 4 — strong
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
                background: active ? barColors[Math.min(score - 1, 3)] : "rgba(0,212,255,0.08)",
                boxShadow:  active ? `0 0 6px ${barColors[Math.min(score - 1, 3)]}50` : "none",
              }}
              transition={{ duration: 0.2 }}
            />
          );
        })}
      </div>
      <span
        className="font-mono text-[9px] tracking-widest uppercase shrink-0"
        style={{ color: labelColor }}
      >
        {hint}
      </span>
    </div>
  );
}
