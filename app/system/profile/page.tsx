// app/system/profile/page.tsx
// Profile settings — identity, security, and account info.

"use client";

import { useState }   from "react";
import { useRouter }  from "next/navigation";
import {
  User, KeyRound, Shield,
  Eye, EyeOff, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn }         from "@/lib/utils";
import { useProfile, useSession } from "@/components/system/SessionContext";
import { ActiveSessions }         from "./ActiveSessions";

// ─── Primitives ───────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-zk-border bg-zk-surface/20 rounded-sm overflow-hidden">
      {children}
    </div>
  );
}

function SectionTitle({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-zk-border/60 bg-black/20">
      <Icon size={12} className="text-zk-green" />
      <span className="font-mono text-[10px] text-zk-green/70 tracking-widest uppercase">
        {label}
      </span>
    </div>
  );
}

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-sans text-xs text-zk-muted/60 uppercase tracking-wide">
          {label}
        </span>
        {hint && (
          <span className="font-sans text-xs text-zk-muted/30">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls = cn(
  "w-full px-3 py-2 rounded-sm",
  "bg-zk-surface/60 border border-zk-border",
  "font-sans text-sm text-zk-white placeholder:text-zk-muted/40",
  "outline-none transition-all duration-200",
  "focus:border-zk-green/60 focus:shadow-glow-sm",
  "disabled:opacity-40 disabled:cursor-not-allowed",
  "caret-zk-green",
);

function TextInput({
  value, onChange, placeholder, disabled,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      className={inputCls}
    />
  );
}

function PasswordInput({
  value, onChange, placeholder, disabled,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="new-password"
        className={cn(inputCls, "pr-9")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zk-muted/40 hover:text-zk-muted transition-colors disabled:opacity-40"
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

function Toast({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div className={cn(
      "flex items-start gap-2 px-3 py-2 rounded-sm border font-sans text-sm",
      type === "success"
        ? "border-zk-green/30 bg-zk-green/5 text-zk-green"
        : "border-zk-red/30 bg-zk-red/5 text-zk-red",
    )}>
      {type === "success"
        ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
        : <AlertCircle  size={13} className="shrink-0 mt-0.5" />
      }
      <span>{message}</span>
    </div>
  );
}

function SaveButton({ saving, label }: { saving: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className={cn(
        "h-8 px-4 rounded-sm border font-sans text-sm font-medium",
        "flex items-center gap-2 transition-all duration-150",
        "border-zk-green/40 bg-zk-green/8 text-zk-green",
        "hover:bg-zk-green/16 hover:border-zk-green/60",
        "disabled:opacity-40 disabled:pointer-events-none",
      )}
    >
      {saving && (
        <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
      )}
      {saving ? "Saving..." : label}
    </button>
  );
}

// ─── Identity ─────────────────────────────────────────────────

function IdentitySection() {
  const profile = useProfile();
  const router  = useRouter();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username,    setUsername]    = useState(profile.username);
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);

    const updates: Record<string, string> = {};
    if (displayName.trim() !== profile.displayName)
      updates.displayName = displayName.trim();
    if (username.trim().toLowerCase() !== profile.username)
      updates.username = username.trim().toLowerCase();

    if (Object.keys(updates).length === 0) {
      setToast({ type: "error", msg: "No changes to save." });
      return;
    }

    setSaving(true);
    try {
      const res  = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", msg: data.error ?? "Failed to update." });
        return;
      }
      // Optimistic context update — header + drawer update immediately
      window.dispatchEvent(new CustomEvent("zk:profile:updated", { detail: updates }));
      setToast({ type: "success", msg: "Identity updated." });
      router.refresh();
    } catch {
      setToast({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard>
      <SectionTitle label="Identity" icon={User} />
      <form onSubmit={handleSave} noValidate className="px-5 py-4 space-y-4">

        <Field label="Display Name" hint="letters, numbers, one space">
          <TextInput
            value={displayName}
            onChange={setDisplayName}
            placeholder="John Doe"
            disabled={saving}
          />
        </Field>

        <Field label="Username" hint="3–20 chars, lowercase">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-zk-green/40 pointer-events-none select-none">
              @
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="your.username"
              disabled={saving}
              autoComplete="off"
              className={cn(inputCls, "pl-7 font-mono")}
            />
          </div>
        </Field>

        {toast && <Toast type={toast.type} message={toast.msg} />}

        <div className="flex justify-end pt-1">
          <SaveButton saving={saving} label="Save Identity" />
        </div>
      </form>
    </SectionCard>
  );
}

// ─── Security ─────────────────────────────────────────────────

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving,          setSaving]          = useState(false);
  const [toast,           setToast]           = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);

    if (!currentPassword) {
      setToast({ type: "error", msg: "Current password is required." });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ type: "error", msg: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ type: "error", msg: "Passwords do not match." });
      return;
    }
    if (newPassword === currentPassword) {
      setToast({ type: "error", msg: "New password must differ from current." });
      return;
    }

    setSaving(true);
    try {
      const res  = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", msg: data.error ?? "Failed to update password." });
        return;
      }
      setToast({ type: "success", msg: "Password updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setToast({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard>
      <SectionTitle label="Security" icon={KeyRound} />
      <form onSubmit={handleSave} noValidate className="px-5 py-4 space-y-4">

        <Field label="Current Password">
          <PasswordInput
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="••••••••"
            disabled={saving}
          />
        </Field>

        <Field label="New Password" hint="min 8 chars">
          <PasswordInput
            value={newPassword}
            onChange={setNewPassword}
            placeholder="••••••••"
            disabled={saving}
          />
        </Field>

        <Field label="Confirm New Password">
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="••••••••"
            disabled={saving}
          />
        </Field>

        {toast && <Toast type={toast.type} message={toast.msg} />}

        <div className="flex justify-end pt-1">
          <SaveButton saving={saving} label="Update Password" />
        </div>
      </form>
    </SectionCard>
  );
}

// ─── Account info (read-only) ─────────────────────────────────

function AccountInfo() {
  const profile = useProfile();
  const session = useSession();

  const rows = [
    { label: "Display ID",  value: profile.displayId > 0 ? `#${profile.displayId}` : "—", accent: true  },
    { label: "Email",       value: session.email,                                           accent: false },
    { label: "Role",        value: profile.role,                                            accent: true  },
    { label: "Last Active", value: (() => {
        const ms = new Date(profile.lastActive).getTime();
        return isNaN(ms) || ms < 1_000_000_000_000
          ? "—"
          : new Date(profile.lastActive).toLocaleString([], {
              year: "numeric", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            });
      })(), accent: false },
  ];

  return (
    <SectionCard>
      <SectionTitle label="Account Info" icon={Shield} />
      <div className="px-5 py-4 space-y-4">

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {rows.map((row) => (
            <div key={row.label} className="space-y-1">
              <p className="font-sans text-[10px] text-zk-muted/40 uppercase tracking-wide">
                {row.label}
              </p>
              <p className={cn(
                "font-mono text-xs truncate",
                row.accent ? "text-zk-green" : "text-zk-slate",
              )}>
                {row.value}
              </p>
            </div>
          ))}
        </div>

        {profile.accessFlagNames.length > 0 && (
          <div className="pt-3 border-t border-zk-border/40 space-y-2">
            <p className="font-sans text-[10px] text-zk-muted/40 uppercase tracking-wide">
              Access Flags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile.accessFlagNames.map((flag) => (
                <span
                  key={flag}
                  className="font-sans text-xs text-zk-green border border-zk-green/20 bg-zk-green/[0.05] rounded px-2 py-0.5"
                >
                  {flag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ProfilePage() {
  const profile = useProfile();
  const initial = (profile.displayName || profile.username).charAt(0).toUpperCase();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-10 h-10 rounded-sm shrink-0",
            "border border-zk-green/30 bg-zk-green/[0.06]",
            "flex items-center justify-center",
          )}>
            <span className="font-mono text-base font-bold text-zk-green text-glow select-none">
              {initial}
            </span>
          </div>
          <div>
            <h1 className="font-sans text-base font-semibold text-zk-white">
              {profile.displayName || profile.username}
            </h1>
            <p className="font-mono text-[10px] text-zk-muted/40 tracking-widest mt-0.5">
              // PROFILE_SETTINGS
            </p>
          </div>
        </div>

        {/* Identity + Security side by side */}
        <div className="grid md:grid-cols-2 gap-4">
          <IdentitySection />
          <SecuritySection />
        </div>

        {/* Account info — full width */}
        <AccountInfo />

        {/* Active sessions — full width */}
        <ActiveSessions />

      </div>
    </div>
  );
}
