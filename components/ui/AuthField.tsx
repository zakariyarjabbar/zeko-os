// components/ui/AuthField.tsx
// Terminal-port styled input used on /login and /signup.
// Supports: password show/hide, Caps-Lock detection, inline validation state,
// optional hint, accent-coloured focus ring.

"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthAccent } from "./AuthShell";

export type FieldState = "idle" | "valid" | "warn" | "error";

interface AuthFieldProps {
  id: string;
  label: string;
  type: "email" | "text" | "password";
  value: string;
  onChange: (v: string) => void;
  accent: AuthAccent;

  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  hint?: string;

  state?: FieldState;
  statusLabel?: string;

  onType?: () => void;
  onFieldFocus?: (id: string) => void;
  onFieldBlur?: (id: string) => void;
  onCapsLockChange?: (on: boolean) => void;
}

export function AuthField({
  id, label, type, value, onChange, accent,
  placeholder, disabled, autoFocus, autoComplete, hint,
  state = "idle", statusLabel,
  onType, onFieldFocus, onFieldBlur, onCapsLockChange,
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const isPw    = type === "password";
  const filled  = value.length > 0;
  const ityp    = isPw && showPw ? "text" : type;

  // Caps-Lock detection: only when a password field is focused.
  useEffect(() => {
    if (!isPw || !focused) return;
    const check = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === "function") {
        const on = e.getModifierState("CapsLock");
        setCapsLock(on);
        onCapsLockChange?.(on);
      }
    };
    window.addEventListener("keydown", check);
    window.addEventListener("keyup",   check);
    return () => {
      window.removeEventListener("keydown", check);
      window.removeEventListener("keyup",   check);
    };
  }, [isPw, focused, onCapsLockChange]);

  // ── Visual state derivations ────────────────────────────────
  const dotBg = (() => {
    if (state === "valid") return accent.hex;
    if (state === "warn")  return "#FFB800";
    if (state === "error") return "#FF3B3B";
    if (focused)           return accent.hex;
    if (filled)            return `rgba(${accent.rgb}, 0.4)`;
    return "rgba(107,122,107,0.3)";
  })();

  const dotGlow = focused || state !== "idle";

  const borderColor = focused
    ? `rgba(${accent.rgb}, 0.55)`
    : state === "error" ? "rgba(255,59,59,0.35)"
    : state === "warn"  ? "rgba(255,184,0,0.30)"
    : state === "valid" ? `rgba(${accent.rgb}, 0.28)`
    : `rgba(${accent.rgb}, 0.10)`;

  const accentLineBg = focused
    ? `rgba(${accent.rgb}, 0.9)`
    : state === "error" ? "rgba(255,59,59,0.55)"
    : state === "warn"  ? "rgba(255,184,0,0.5)"
    : filled            ? `rgba(${accent.rgb}, 0.3)`
    : `rgba(${accent.rgb}, 0.1)`;

  // Right-side status tag
  const tag = (() => {
    if (!filled) return null;
    if (statusLabel)         return statusLabel;
    if (state === "error")   return "BAD";
    if (state === "warn")    return "CHK";
    if (isPw)                return "SECURED";
    return "OK";
  })();
  const tagColor =
      state === "error" ? "rgba(255,59,59,0.7)"
    : state === "warn"  ? "rgba(255,184,0,0.75)"
    : `rgba(${accent.rgb}, 0.5)`;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="font-mono text-[10px] tracking-[0.22em] uppercase transition-colors duration-200"
          style={{ color: focused ? `rgba(${accent.rgb}, 0.85)` : "rgba(107,122,107,1)" }}
        >
          {label}
        </label>
        <div className="flex items-center gap-2">
          {isPw && capsLock ? (
            <span
              className="flex items-center gap-1 font-mono text-[9px] tracking-widest"
              style={{ color: "#FFB800" }}
            >
              <AlertCircle size={9} /> CAPS
            </span>
          ) : hint ? (
            <span className="font-mono text-[9px] text-zk-muted/45 tracking-wider">
              {hint}
            </span>
          ) : null}
          <span
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              background: dotBg,
              boxShadow: dotGlow ? `0 0 6px ${dotBg}` : "none",
            }}
          />
        </div>
      </div>

      {/* Input box */}
      <div
        className="relative transition-all duration-200"
        style={{
          border: `1px solid ${borderColor}`,
          boxShadow: focused
            ? `0 0 14px rgba(${accent.rgb}, 0.12), inset 0 0 8px rgba(${accent.rgb}, 0.03)`
            : "none",
          background: "rgba(0,0,0,0.38)",
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 transition-all duration-200"
          style={{
            width: 2,
            background: accentLineBg,
            boxShadow: focused ? `0 0 6px rgba(${accent.rgb}, 0.6)` : "none",
          }}
        />
        <input
          id={id}
          type={ityp}
          value={value}
          onChange={(e) => { onChange(e.target.value); onType?.(); }}
          onFocus={() => { setFocused(true);  onFieldFocus?.(id); }}
          onBlur={() =>  { setFocused(false); onFieldBlur?.(id); setCapsLock(false); }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className={cn(
            "w-full pl-4 py-3",
            isPw ? "pr-24" : "pr-20",
            "font-mono text-sm text-zk-white placeholder:text-zk-muted/35",
            "bg-transparent outline-none",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
          style={{ caretColor: accent.hex }}
        />

        {/* Right cluster: status tag + eye toggle */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {tag && (
            <span
              className="font-mono text-[9px] tracking-widest pointer-events-none"
              style={{ color: tagColor }}
            >
              {tag}
            </span>
          )}
          {isPw && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPw((v) => !v)}
              className="p-1 text-zk-muted hover:text-zk-white transition-colors"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
