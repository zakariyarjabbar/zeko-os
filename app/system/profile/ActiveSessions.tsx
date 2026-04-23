// app/system/profile/ActiveSessions.tsx
// Fourth card on /system/profile — lists every signed-in device
// for the current user with revoke controls.
//
// Data flow:
//   • On mount: GET /api/sessions → { currentSid, sessions: [...] }
//   • Revoke one:  DELETE /api/sessions/:id
//                  If the revoked row is the current one, the API
//                  clears the cookie and returns { loggedOut: true }
//                  — we push the user to /login in response.
//   • Revoke all others: DELETE /api/sessions?scope=others
//                  → refetch so the list collapses to one row.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor, Trash2, Radio, AlertCircle, CheckCircle2, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Shared types (mirror app/api/sessions/route.ts serialize()) ──

interface SessionItem {
  id:         string;
  current:    boolean;
  device:     string;
  ip:         string;
  createdAt:  string;
  lastActive: string;
  expiresAt:  string;
  persist:    boolean;
}

// ── Humanized timestamps ─────────────────────────────────────────
// Keep the UI light — "3 minutes ago" for fresh, "2 days ago" for old.
// Anything over 30 days just shows the absolute date.

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const sec  = Math.floor(diff / 1000);
  if (sec < 5)              return "just now";
  if (sec < 60)             return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)             return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24)             return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)            return `${days} d ago`;
  return new Date(iso).toLocaleDateString([], {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────

export function ActiveSessions() {
  const router = useRouter();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // `pendingId` = row that's mid-revoke; "__others__" = bulk action in flight
  const [pendingId, setPendingId] = useState<string | "__others__" | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function load() {
    setError(null);
    try {
      const res  = await fetch("/api/sessions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load sessions.");
        return;
      }
      setSessions(data.sessions as SessionItem[]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Revoke one ──────────────────────────────────────────────
  async function revokeOne(s: SessionItem) {
    if (pendingId) return;
    const label = s.current ? "sign yourself out on this device" : "revoke this session";
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;

    setPendingId(s.id);
    setToast(null);
    try {
      const res  = await fetch(`/api/sessions/${s.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", msg: data.error ?? "Failed to revoke." });
        return;
      }
      // If this was the current session, the API cleared the cookie.
      if (data.loggedOut) {
        router.push("/login");
        return;
      }
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
      setToast({ type: "success", msg: "Session revoked." });
    } catch {
      setToast({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  // ── Revoke all others ──────────────────────────────────────
  async function revokeOthers() {
    if (pendingId) return;
    const others = sessions.filter((s) => !s.current).length;
    if (others === 0) return;
    if (!window.confirm(`Sign out ${others} other device${others === 1 ? "" : "s"}?`)) return;

    setPendingId("__others__");
    setToast(null);
    try {
      const res  = await fetch(`/api/sessions?scope=others`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", msg: data.error ?? "Failed to revoke." });
        return;
      }
      // Refetch is cleaner than filtering — the server is the source of truth.
      await load();
      setToast({ type: "success", msg: `Revoked ${others} session${others === 1 ? "" : "s"}.` });
    } catch {
      setToast({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  const otherCount = sessions.filter((s) => !s.current).length;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="border border-zk-border bg-zk-surface/20 rounded-sm overflow-hidden">

      {/* Header — matches the other SectionTitle cards */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zk-border/60 bg-black/20">
        <div className="flex items-center gap-2">
          <ShieldAlert size={12} className="text-zk-green" />
          <span className="font-mono text-[10px] text-zk-green/70 tracking-widest uppercase">
            Active Sessions
          </span>
        </div>

        {otherCount > 0 && (
          <button
            type="button"
            onClick={revokeOthers}
            disabled={pendingId !== null}
            className={cn(
              "h-6 px-2.5 rounded-sm border font-sans text-[11px] font-medium",
              "flex items-center gap-1.5 transition-all duration-150",
              "border-zk-red/40 bg-zk-red/5 text-zk-red",
              "hover:bg-zk-red/12 hover:border-zk-red/60",
              "disabled:opacity-40 disabled:pointer-events-none",
            )}
          >
            {pendingId === "__others__" && (
              <span className="w-2.5 h-2.5 border border-zk-red border-t-transparent rounded-full animate-spin" />
            )}
            Revoke all others
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-zk-muted/60 font-sans text-sm">
            <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
            Loading sessions…
          </div>
        )}

        {/* Load error */}
        {!loading && error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-sm border border-zk-red/30 bg-zk-red/5 text-zk-red font-sans text-sm">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* List */}
        {!loading && !error && sessions.length === 0 && (
          <p className="font-sans text-sm text-zk-muted/50">No active sessions.</p>
        )}

        {!loading && !error && sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            pending={pendingId === s.id}
            disabled={pendingId !== null && pendingId !== s.id}
            onRevoke={() => revokeOne(s)}
          />
        ))}

        {/* Toast */}
        {toast && (
          <div className={cn(
            "flex items-start gap-2 px-3 py-2 rounded-sm border font-sans text-sm mt-2",
            toast.type === "success"
              ? "border-zk-green/30 bg-zk-green/5 text-zk-green"
              : "border-zk-red/30 bg-zk-red/5 text-zk-red",
          )}>
            {toast.type === "success"
              ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
              : <AlertCircle  size={13} className="shrink-0 mt-0.5" />}
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Row ─────────────────────────────────────────────────────────

function SessionRow({
  session, pending, disabled, onRevoke,
}: {
  session:  SessionItem;
  pending:  boolean;
  disabled: boolean;
  onRevoke: () => void;
}) {
  return (
    <div className={cn(
      "flex items-start gap-3 px-3 py-3 rounded-sm border",
      session.current
        ? "border-zk-green/30 bg-zk-green/[0.04]"
        : "border-zk-border/60 bg-zk-surface/10",
    )}>

      {/* Device icon */}
      <div className={cn(
        "w-7 h-7 shrink-0 rounded-sm flex items-center justify-center",
        session.current
          ? "bg-zk-green/10 text-zk-green"
          : "bg-zk-surface/40 text-zk-muted",
      )}>
        <Monitor size={13} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans text-sm text-zk-white truncate">
            {session.device}
          </span>
          {session.current && (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-zk-green border border-zk-green/40 bg-zk-green/[0.08] rounded-sm px-1.5 py-0.5">
              <Radio size={8} /> This device
            </span>
          )}
          {session.persist && (
            <span className="font-mono text-[9px] uppercase tracking-widest text-zk-muted/60 border border-zk-border/60 rounded-sm px-1.5 py-0.5">
              Remember me
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-zk-muted/60">
          <span>ip: <span className="text-zk-slate">{session.ip}</span></span>
          <span>issued: <span className="text-zk-slate">{timeAgo(session.createdAt)}</span></span>
          <span>last active: <span className="text-zk-slate">{timeAgo(session.lastActive)}</span></span>
        </div>
      </div>

      {/* Revoke */}
      <button
        type="button"
        onClick={onRevoke}
        disabled={disabled || pending}
        title={session.current ? "Sign out on this device" : "Revoke this session"}
        className={cn(
          "h-7 px-2.5 rounded-sm border font-sans text-[11px] font-medium shrink-0",
          "flex items-center gap-1.5 transition-all duration-150",
          "border-zk-red/40 bg-zk-red/5 text-zk-red",
          "hover:bg-zk-red/12 hover:border-zk-red/60",
          "disabled:opacity-40 disabled:pointer-events-none",
        )}
      >
        {pending
          ? <span className="w-2.5 h-2.5 border border-zk-red border-t-transparent rounded-full animate-spin" />
          : <Trash2 size={11} />}
        {session.current ? "Sign out" : "Revoke"}
      </button>
    </div>
  );
}
