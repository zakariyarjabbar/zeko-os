// app/system/users/page.tsx
// User Manager — moderator / admin / Administrator.
// Left: searchable registry with status filters.
// Right: dossier view (read-only) → edit form (explicit action).

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Trash2, Edit3, RefreshCw, X,
  CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck,
  Search, Terminal, ChevronRight, Lock, Clock, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/components/system/SessionContext";
import { canCreateUsers, canDeleteUsers, isFounder } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────
interface Permission { id: string; name: string; description: string; }
interface Role       { id: string; name: string; }
interface UserProfile {
  id:             string;
  display_id:     number;
  display_name:   string;
  username:       string;
  access_flags:   string[];
  session_status: string;
}
interface UserRow {
  id: string; email: string; emailConfirmed: boolean;
  createdAt: string; lastSignIn: string | null;
  profile: UserProfile | null; roles: Role[];
}

const STATUS_DOT: Record<string, string> = {
  ONLINE:  "bg-zk-green shadow-glow-sm",
  OFFLINE: "bg-zk-muted/40",
};

type StatusFilter = "ALL" | "ONLINE" | "OFFLINE";
type RightMode    = null | "dossier" | "create" | "edit";

// ─── Helpers ──────────────────────────────────────────────────
function getInitials(username: string) {
  return (username || "??").slice(0, 2).toUpperCase();
}

function getAvatarClass(flags: string[]) {
  if (flags.includes("Administrator"))
    return "bg-zk-green/15 text-zk-green border-zk-green/35";
  if (flags.includes("admin"))
    return "bg-zk-cyan/15 text-zk-cyan border-zk-cyan/35";
  return "bg-zk-muted/8 text-zk-slate border-zk-muted/20";
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function blankForm() {
  return {
    email: "", password: "",
    username: "", displayName: "",
    accessFlags: [] as string[], roleIds: [] as string[],
  };
}

// ─── Shared primitives ────────────────────────────────────────
function Field({ label, children, required }: {
  label: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label className="block font-sans text-xs text-zk-muted/50 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-zk-green ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      autoComplete="off" spellCheck={false}
      className={cn(
        "w-full px-3 py-2 rounded border bg-zk-surface/60 border-zk-border",
        "font-sans text-sm text-zk-white placeholder:text-zk-muted/30",
        "outline-none focus:border-zk-green/50 transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-sans text-xs text-zk-muted/50 uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-2 py-2 border-b border-zk-border/10 last:border-0">
      <span className="font-sans text-xs text-zk-muted/40 pt-px">{label}</span>
      <span className="font-sans text-sm text-zk-white leading-snug break-all">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ONLINE"
      ? "border-zk-green/30 bg-zk-green/8 text-zk-green"
      : "border-zk-muted/20 bg-transparent text-zk-muted/50";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-sans text-xs",
      "px-2 py-0.5 rounded-sm border", cls,
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status] ?? STATUS_DOT.OFFLINE)} />
      {status}
    </span>
  );
}

function FlagChip({ flag, active, onClick }: { flag: string; active: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "font-sans text-xs px-2.5 py-1 rounded border transition-all duration-150",
        "disabled:pointer-events-none",
        active
          ? "border-zk-green/50 bg-zk-green/12 text-zk-green"
          : onClick
            ? "border-zk-border/40 text-zk-muted/40 hover:text-zk-slate hover:border-zk-border"
            : "border-zk-border/25 text-zk-muted/25",
      )}
    >
      {flag}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function UsersPage() {
  const profile     = useProfile();
  const actorFlags  = profile.accessFlags;
  const isModerator = actorFlags.includes("moderator")
    && !actorFlags.includes("admin")
    && !isFounder(actorFlags);
  const canCreate = canCreateUsers(actorFlags);
  const canDelete = canDeleteUsers(actorFlags);

  // data
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles,       setRoles]       = useState<Role[]>([]);
  const [loading,     setLoading]     = useState(true);

  // selection
  const [selected,  setSelected]  = useState<UserRow | null>(null);
  const [rightMode, setRightMode] = useState<RightMode>(null);

  // form
  const [form,     setForm]     = useState(blankForm());
  const [showPass, setShowPass] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast,    setToast]    = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // filters
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // presence — live ONLINE/OFFLINE per user id
  const [presence, setPresence] = useState<Record<string, "ONLINE" | "OFFLINE">>({});

  // ── Data fetching ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [uRes, pRes, rRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/permissions"),
      fetch("/api/roles"),
    ]);
    if (uRes.ok) setUsers(await uRes.json());
    if (pRes.ok) setPermissions(await pRes.json());
    if (rRes.ok) setRoles(await rRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchPresence = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/presence?ids=${ids.join(",")}`);
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data === "object" && !Array.isArray(data) && !("error" in data)) {
        setPresence(data as Record<string, "ONLINE" | "OFFLINE">);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const ids = users.map((u) => u.id);
    fetchPresence(ids);
  }, [users, fetchPresence]);

  useEffect(() => {
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return;
    const id = setInterval(() => fetchPresence(ids), 20_000);
    return () => clearInterval(id);
  }, [users, fetchPresence]);

  // ── Derived data ───────────────────────────────────────────
  const filtered = useMemo(() => users.filter((u) => {
    const hay = [
      u.profile?.username,
      u.email,
      ...u.roles.map((r) => r.name),
    ].filter(Boolean).join(" ").toLowerCase();
    const matchSearch = !search || hay.includes(search.toLowerCase());
    const st = presence[u.id] ?? "OFFLINE";
    return matchSearch && (statusFilter === "ALL" || st === statusFilter);
  }), [users, search, statusFilter, presence]);

  const onlineCount  = users.filter((u) => presence[u.id] === "ONLINE").length;
  const offlineCount = users.length - onlineCount;

  // ── Actions ────────────────────────────────────────────────
  function openDossier(user: UserRow) {
    setSelected(user);
    setRightMode("dossier");
    setToast(null);
  }

  function openCreate() {
    setSelected(null);
    setForm(blankForm());
    setRightMode("create");
    setToast(null);
    setShowPass(false);
  }

  function openEdit(user: UserRow) {
    setSelected(user);
    setForm({
      email:        user.email,
      password:     "",
      username:     user.profile?.username     ?? "",
      displayName:  user.profile?.display_name ?? "",
      accessFlags:  user.profile?.access_flags  ?? [],
      roleIds:      user.roles.map((r) => r.id),
    });
    setRightMode("edit");
    setToast(null);
    setShowPass(false);
  }

  function toggleFlag(flag: string) {
    setForm((p) => ({
      ...p,
      accessFlags: p.accessFlags.includes(flag)
        ? p.accessFlags.filter((f) => f !== flag)
        : [...p.accessFlags, flag],
    }));
  }

  function toggleRole(id: string) {
    setForm((p) => ({
      ...p,
      roleIds: p.roleIds.includes(id)
        ? p.roleIds.filter((r) => r !== id)
        : [...p.roleIds, id],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      if (rightMode === "create") {
        const res  = await fetch("/api/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:        form.email,
            password:     form.password,
            username:     form.username,
            displayName:  form.displayName,
            accessFlags:  form.accessFlags,
            roleIds:      form.roleIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create user.");
        await fetchAll();
        setRightMode(null);
        setSelected(null);
        setToast({ type: "ok", msg: "User created." });
      } else if (rightMode === "edit" && selected) {
        const res  = await fetch(`/api/users/${selected.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username:     form.username,
            displayName:  form.displayName,
            accessFlags:  form.accessFlags,
            roleIds:      form.roleIds,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to update user.");
        const updatedList = await (await fetch("/api/users")).json() as UserRow[];
        setUsers(updatedList);
        const fresh = updatedList.find((u) => u.id === selected.id) ?? null;
        setSelected(fresh);
        setRightMode("dossier");
        setToast({ type: "ok", msg: "User updated." });
      }
    } catch (e) {
      setToast({ type: "err", msg: e instanceof Error ? e.message : "Unknown error." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    const res  = await fetch(`/api/users/${selected.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "err", msg: data.error ?? "Delete failed." });
    } else {
      setSelected(null);
      setRightMode(null);
      await fetchAll();
    }
    setDeleting(false);
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Stats ribbon ───────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-5 h-8 border-b border-zk-border/40 bg-zk-surface/10">
        <Terminal size={10} className="text-zk-green/40 shrink-0" />
        <span className="font-sans text-xs text-zk-muted/40">User Registry</span>
        <span className="text-zk-border/60">·</span>
        <span className="font-sans text-xs text-zk-muted/40">{users.length} records</span>
        <span className="flex items-center gap-1.5 font-sans text-xs text-zk-green/60">
          <span className="w-1.5 h-1.5 rounded-full bg-zk-green shadow-glow-sm" />
          {onlineCount} online
        </span>
        <span className="flex items-center gap-1.5 font-sans text-xs text-zk-muted/30">
          <span className="w-1.5 h-1.5 rounded-full bg-zk-muted/30" />
          {offlineCount} offline
        </span>
        <div className="ml-auto font-sans text-xs text-zk-muted/25">
          {roles.length} roles · {permissions.length} permissions
        </div>
      </div>

      {/* ── Split layout ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL: Registry ─────────────────────────── */}
        <div className="w-[17.5rem] shrink-0 flex flex-col border-r border-zk-border/50 bg-zk-surface/15">

          {/* Panel controls */}
          <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-zk-border/30 space-y-2.5">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={12} className="text-zk-green" />
                <span className="font-sans text-sm font-semibold text-zk-white">Users</span>
                <span className="font-sans text-xs text-zk-muted/35">
                  {filtered.length !== users.length ? `${filtered.length}/${users.length}` : users.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchAll}
                  title="Refresh registry"
                  className="p-1 text-zk-muted/35 hover:text-zk-green transition-colors"
                >
                  <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                </button>
                {canCreate && (
                  <button
                    onClick={openCreate}
                    className="flex items-center gap-1 px-2 py-1 rounded-sm border font-sans text-xs text-zk-green border-zk-green/25 bg-zk-green/5 hover:bg-zk-green/12 hover:border-zk-green/50 transition-all"
                  >
                    <UserPlus size={9} /> New
                  </button>
                )}
              </div>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zk-muted/35 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="search users..."
                className={cn(
                  "w-full pl-7 pr-3 py-1.5 rounded-sm border bg-zk-surface/50 border-zk-border/50",
                  "font-sans text-sm text-zk-white placeholder:text-zk-muted/25",
                  "outline-none focus:border-zk-green/35 transition-colors",
                )}
              />
            </div>

            {/* Status pills */}
            <div className="flex gap-1">
              {(["ALL", "ONLINE", "OFFLINE"] as StatusFilter[]).map((f) => {
                const cnt =
                  f === "ALL"     ? users.length :
                  f === "ONLINE"  ? onlineCount  :
                                    offlineCount;
                const onStyle =
                  f === "ONLINE"  ? "border-zk-green/35 bg-zk-green/10 text-zk-green" :
                  f === "OFFLINE" ? "border-zk-muted/25 bg-zk-muted/5 text-zk-muted/55" :
                                    "border-zk-green/30 bg-zk-green/8 text-zk-green";
                const label = f === "ALL" ? "All" : f[0] + f.slice(1).toLowerCase();
                return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "flex-1 py-1 rounded-sm border font-sans text-xs transition-all leading-tight",
                      statusFilter === f
                        ? onStyle
                        : "border-zk-border/20 text-zk-muted/25 hover:text-zk-muted/50 hover:border-zk-border/40",
                    )}
                  >
                    {label}{cnt > 0 && <span className="ml-0.5 opacity-60"> {cnt}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3.5 border-b border-zk-border/15 animate-pulse">
                  <div className="w-8 h-8 rounded-sm bg-zk-green/5 border border-zk-border/15 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-zk-green/8 rounded w-2/3" />
                    <div className="h-2 bg-zk-green/4 rounded w-5/6" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <Search size={20} className="text-zk-muted/15" />
                <p className="font-sans text-xs text-zk-muted/30">No match</p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="font-sans text-xs text-zk-green/40 hover:text-zk-green/70 transition-colors"
                  >
                    clear filter
                  </button>
                )}
              </div>
            ) : (
              filtered.map((user) => {
                const isActive = (rightMode === "dossier" || rightMode === "edit") && selected?.id === user.id;
                const st    = presence[user.id] ?? "OFFLINE";
                const uname = user.profile?.username ?? user.email.split("@")[0];
                const flags = user.profile?.access_flags ?? [];

                return (
                  <button
                    key={user.id}
                    onClick={() => openDossier(user)}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-3 py-3",
                      "border-b border-zk-border/15 border-l-2 transition-all duration-150",
                      isActive
                        ? "bg-zk-green/[0.04] border-l-zk-green"
                        : "border-l-transparent hover:bg-zk-green/[0.02] hover:border-l-zk-green/25",
                    )}
                  >
                    {/* Avatar with status dot */}
                    <div className="relative shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-sm border flex items-center justify-center",
                        "font-mono text-[11px] font-bold",
                        getAvatarClass(flags),
                      )}>
                        {getInitials(uname)}
                      </div>
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2",
                        "border-zk-surface",
                        STATUS_DOT[st] ?? STATUS_DOT.OFFLINE,
                      )} />
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-sans text-sm text-zk-white font-medium truncate">
                          {user.profile?.display_name || `@${uname}`}
                        </span>
                        {flags.includes("Administrator") && (
                          <ShieldCheck size={9} className="text-zk-green shrink-0" />
                        )}
                      </div>
                      <p className="font-sans text-xs truncate">
                        {user.profile?.display_id
                          ? <span className="text-zk-green/55">#{user.profile.display_id}</span>
                          : null}
                        {user.profile?.display_id && <span className="text-zk-muted/30 mx-1">·</span>}
                        <span className="text-zk-muted/40">{user.email}</span>
                      </p>
                      {user.roles.length > 0 && (
                        <p className="font-sans text-xs text-zk-muted/30 truncate mt-0.5">
                          {user.roles.map((r) => r.name).join(", ")}
                        </p>
                      )}
                    </div>

                    {isActive && <ChevronRight size={10} className="text-zk-green/30 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-zk-bg overflow-hidden">

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                className={cn(
                  "shrink-0 flex items-center gap-2 px-5 py-2 border-b font-sans text-sm",
                  toast.type === "ok"
                    ? "border-zk-green/15 bg-zk-green/5 text-zk-green"
                    : "border-zk-red/15 bg-zk-red/5 text-zk-red",
                )}
              >
                {toast.type === "ok"
                  ? <CheckCircle2 size={12} />
                  : <AlertCircle  size={12} />}
                {toast.msg}
                <button onClick={() => setToast(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity">
                  <X size={11} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">

            {/* ── DOSSIER ─────────────────────────────────── */}
            {rightMode === "dossier" && selected && (
              <motion.div
                key={`dossier-${selected.id}`}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                className="flex flex-col h-full"
              >
                {/* Dossier header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zk-border/50 bg-zk-surface/15">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={cn(
                      "w-10 h-10 rounded-sm border flex items-center justify-center",
                      "font-mono text-sm font-bold relative",
                      getAvatarClass(selected.profile?.access_flags ?? []),
                    )}>
                      {getInitials(selected.profile?.username ?? selected.email.split("@")[0])}
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zk-surface",
                        STATUS_DOT[presence[selected.id] ?? "OFFLINE"],
                      )} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-sm font-semibold text-zk-white">
                          @{selected.profile?.username ?? selected.email.split("@")[0]}
                        </span>
                        <StatusBadge status={presence[selected.id] ?? "OFFLINE"} />
                      </div>
                      <p className="font-mono text-xs text-zk-muted/45 mt-0.5">
                        {selected.profile?.display_id
                          ? <span className="text-zk-green/55">#{selected.profile.display_id} · </span>
                          : null}
                        {selected.email}
                      </p>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!isModerator && (
                      <button
                        onClick={() => openEdit(selected)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border font-sans text-sm border-zk-border/50 text-zk-slate hover:text-zk-white hover:border-zk-green/30 transition-all"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border font-sans text-sm border-zk-red/25 bg-zk-red/5 text-zk-red hover:bg-zk-red/12 hover:border-zk-red/50 disabled:opacity-40 transition-all"
                      >
                        {deleting
                          ? <span className="w-3 h-3 border border-zk-red border-t-transparent rounded-full animate-spin" />
                          : <Trash2 size={11} />}
                        Delete
                      </button>
                    )}
                    <button onClick={() => { setSelected(null); setRightMode(null); }} className="text-zk-muted/40 hover:text-zk-white transition-colors ml-1">
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Dossier body */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-0 divide-x divide-zk-border/20">

                    {/* Left col */}
                    <div className="px-6 py-5 space-y-6">
                      {/* Identity */}
                      <div>
                        <SectionLabel>identity</SectionLabel>
                        <div className="space-y-0">
                          <DRow label="Display Name" value={selected.profile?.display_name || <span className="text-zk-muted/30 italic">not set</span>} />
                          <DRow label="Username"     value={<span className="text-zk-green/80">@{selected.profile?.username ?? "—"}</span>} />
                          <DRow label="Display ID"   value={<span className="text-zk-green/80 font-bold">#{selected.profile?.display_id ?? "—"}</span>} />
                          <DRow label="Email"        value={selected.email} />
                          <DRow label="Confirmed"  value={
                            selected.emailConfirmed
                              ? <span className="text-zk-green text-[10px]">✓ verified</span>
                              : <span className="text-zk-amber text-[10px]">⚠ unverified</span>
                          } />
                        </div>
                      </div>

                      {/* Session */}
                      <div>
                        <SectionLabel>session</SectionLabel>
                        <div className="space-y-0">
                          <DRow label="Status"      value={<StatusBadge status={presence[selected.id] ?? "OFFLINE"} />} />
                          <DRow label="Last active" value={
                            <span className="flex items-center gap-1.5">
                              <Clock size={9} className="text-zk-muted/40" />
                              {timeAgo(selected.lastSignIn)}
                            </span>
                          } />
                          <DRow label="Created"     value={timeAgo(selected.createdAt)} />
                        </div>
                      </div>
                    </div>

                    {/* Right col */}
                    <div className="px-6 py-5 space-y-6">
                      {/* Roles */}
                      <div>
                        <SectionLabel>roles</SectionLabel>
                        {selected.roles.length === 0 ? (
                          <p className="font-sans text-xs text-zk-muted/25 italic">No roles assigned</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {selected.roles.map((r) => (
                              <FlagChip key={r.id} flag={r.name} active={true} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Access flags */}
                      <div>
                        <SectionLabel>access flags</SectionLabel>
                        {(selected.profile?.access_flags ?? []).length === 0 ? (
                          <p className="font-sans text-xs text-zk-muted/25 italic">No flags assigned</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {(selected.profile?.access_flags ?? []).map((f) => (
                              <FlagChip key={f} flag={f} active={true} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* System meta */}
                      <div>
                        <SectionLabel>system</SectionLabel>
                        <div className="space-y-0">
                          <DRow label="User ID" value={
                            <span className="text-zk-muted/50 text-[10px] break-all">{selected.id}</span>
                          } />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── EDIT FORM ───────────────────────────────── */}
            {rightMode === "edit" && selected && (
              <motion.div
                key={`edit-${selected.id}`}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                className="flex flex-col h-full"
              >
                <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zk-border/50 bg-zk-surface/15">
                  <div className="flex items-center gap-2">
                    <Edit3 size={13} className="text-zk-green" />
                    <span className="font-sans text-sm font-semibold text-zk-white">Edit User</span>
                    <span className="font-mono text-xs text-zk-muted/40 ml-1">
                      #{selected.profile?.display_id} @{selected.profile?.username ?? selected.email}
                    </span>
                  </div>
                  <button
                    onClick={() => { setRightMode("dossier"); setToast(null); }}
                    className="text-zk-muted/40 hover:text-zk-white transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

                  {/* Identity */}
                  <div>
                    <SectionLabel>identity</SectionLabel>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Display Name">
                        <TextInput
                          value={form.displayName}
                          onChange={(v) => setForm((p) => ({ ...p, displayName: v }))}
                          placeholder="Zakariya Jabbar"
                        />
                      </Field>
                      <Field label="Username" required>
                        <TextInput
                          value={form.username}
                          onChange={(v) => setForm((p) => ({ ...p, username: v }))}
                          placeholder="zeko"
                        />
                      </Field>
                      <Field label="Email">
                        <TextInput value={form.email} onChange={() => {}} placeholder="—" disabled />
                      </Field>
                    </div>
                  </div>

                  {/* Credentials */}
                  <div>
                    <SectionLabel>credentials</SectionLabel>
                    <div className="max-w-sm">
                      <Field label="New Password (leave blank to keep current)">
                        <div className="relative">
                          <Lock size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-zk-muted/30 pointer-events-none" />
                          <input
                            type={showPass ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                            placeholder="min. 8 characters"
                            autoComplete="new-password"
                            className={cn(
                              "w-full pl-8 pr-8 py-2 rounded border bg-zk-surface/60 border-zk-border",
                              "font-sans text-sm text-zk-white placeholder:text-zk-muted/30",
                              "outline-none focus:border-zk-green/50 transition-colors",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zk-muted/35 hover:text-zk-green transition-colors"
                          >
                            {showPass ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* Roles */}
                  {!isModerator && (
                    <div>
                      <SectionLabel>roles</SectionLabel>
                      {roles.length === 0 ? (
                        <p className="font-sans text-xs text-zk-muted/30 italic">No roles defined yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {roles.map((r) => (
                            <FlagChip
                              key={r.id} flag={r.name}
                              active={form.roleIds.includes(r.id)}
                              onClick={() => toggleRole(r.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Access flags */}
                  {!isModerator && (
                    <div>
                      <SectionLabel>access flags</SectionLabel>
                      {permissions.length === 0 ? (
                        <p className="font-sans text-xs text-zk-muted/30 italic">No permissions defined yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {permissions.map((perm) => (
                            <FlagChip
                              key={perm.id} flag={perm.name}
                              active={form.accessFlags.includes(perm.name)}
                              onClick={() => toggleFlag(perm.name)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Save bar */}
                <div className="shrink-0 px-6 py-4 border-t border-zk-border/40 bg-zk-surface/10 flex items-center justify-between">
                  <button
                    onClick={() => { setRightMode("dossier"); setToast(null); }}
                    className="font-sans text-sm text-zk-muted/40 hover:text-zk-slate transition-colors"
                  >
                    ← Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded border font-sans text-sm font-medium border-zk-green/35 bg-zk-green/8 text-zk-green hover:bg-zk-green/18 hover:border-zk-green/60 disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    {saving
                      ? <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
                      : <CheckCircle2 size={13} />}
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── CREATE FORM ─────────────────────────────── */}
            {rightMode === "create" && (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                className="flex flex-col h-full"
              >
                <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zk-border/50 bg-zk-surface/15">
                  <div className="flex items-center gap-2">
                    <UserPlus size={13} className="text-zk-green" />
                    <span className="font-sans text-sm font-semibold text-zk-white">Create User</span>
                  </div>
                  <button
                    onClick={() => { setRightMode(null); setSelected(null); }}
                    className="text-zk-muted/40 hover:text-zk-white transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

                  <div>
                    <SectionLabel>identity</SectionLabel>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Display Name">
                        <TextInput
                          value={form.displayName}
                          onChange={(v) => setForm((p) => ({ ...p, displayName: v }))}
                          placeholder="Zakariya Jabbar"
                        />
                      </Field>
                      <Field label="Username" required>
                        <TextInput
                          value={form.username}
                          onChange={(v) => setForm((p) => ({ ...p, username: v }))}
                          placeholder="zeko"
                        />
                      </Field>
                      <Field label="Email" required>
                        <div className="relative">
                          <Globe size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-zk-muted/30 pointer-events-none" />
                          <input
                            type="email" value={form.email}
                            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="user@zeko.os"
                            autoComplete="off"
                            className={cn(
                              "w-full pl-8 pr-3 py-2 rounded border bg-zk-surface/60 border-zk-border",
                              "font-sans text-sm text-zk-white placeholder:text-zk-muted/30",
                              "outline-none focus:border-zk-green/50 transition-colors",
                            )}
                          />
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div>
                    <SectionLabel>credentials</SectionLabel>
                    <div className="max-w-sm">
                      <Field label="Password" required>
                        <div className="relative">
                          <Lock size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-zk-muted/30 pointer-events-none" />
                          <input
                            type={showPass ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                            placeholder="min. 8 characters"
                            autoComplete="new-password"
                            className={cn(
                              "w-full pl-8 pr-8 py-2 rounded border bg-zk-surface/60 border-zk-border",
                              "font-sans text-sm text-zk-white placeholder:text-zk-muted/30",
                              "outline-none focus:border-zk-green/50 transition-colors",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zk-muted/35 hover:text-zk-green transition-colors"
                          >
                            {showPass ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      </Field>
                    </div>
                  </div>

                  {!isModerator && (
                    <div>
                      <SectionLabel>roles</SectionLabel>
                      {roles.length === 0 ? (
                        <p className="font-sans text-xs text-zk-muted/30 italic">No roles defined yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {roles.map((r) => (
                            <FlagChip
                              key={r.id} flag={r.name}
                              active={form.roleIds.includes(r.id)}
                              onClick={() => toggleRole(r.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!isModerator && (
                    <div>
                      <SectionLabel>access flags</SectionLabel>
                      {permissions.length === 0 ? (
                        <p className="font-sans text-xs text-zk-muted/30 italic">No permissions defined yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {permissions.map((perm) => (
                            <FlagChip
                              key={perm.id} flag={perm.name}
                              active={form.accessFlags.includes(perm.name)}
                              onClick={() => toggleFlag(perm.name)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="shrink-0 px-6 py-4 border-t border-zk-border/40 bg-zk-surface/10 flex items-center justify-between">
                  <button
                    onClick={() => setRightMode(null)}
                    className="font-sans text-sm text-zk-muted/40 hover:text-zk-slate transition-colors"
                  >
                    ← Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.email || !form.username || !form.password}
                    className="flex items-center gap-2 px-5 py-2 rounded border font-sans text-sm font-medium border-zk-green/35 bg-zk-green/8 text-zk-green hover:bg-zk-green/18 hover:border-zk-green/60 disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    {saving
                      ? <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
                      : <UserPlus size={13} />}
                    {saving ? "Creating..." : "Create User"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── EMPTY STATE ──────────────────────────────── */}
            {rightMode === null && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-4"
              >
                <div className="w-16 h-16 rounded-sm border border-zk-border/20 bg-zk-green/[0.02] flex items-center justify-center">
                  <Users size={24} className="text-zk-green/20" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-sans text-sm text-zk-muted/30">Select a user</p>
                  <p className="font-sans text-xs text-zk-muted/20">or create a new identity</p>
                </div>
                {canCreate && (
                  <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 rounded border font-sans text-sm font-medium border-zk-green/25 bg-zk-green/5 text-zk-green/60 hover:text-zk-green hover:bg-zk-green/12 hover:border-zk-green/40 transition-all"
                  >
                    <UserPlus size={12} /> New User
                  </button>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
