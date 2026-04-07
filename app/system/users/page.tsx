// app/system/users/page.tsx
// User Manager — Administrator only.
// List left, create/edit right. Permissions loaded from DB.

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Trash2, Edit3,
  RefreshCw, X, CheckCircle2, AlertCircle,
  Eye, EyeOff, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/components/system/SessionContext";
import { canCreateUsers, canDeleteUsers, isFounder } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────
interface Permission { id: string; name: string; description: string; }
interface Role       { id: string; name: string; }

interface UserProfile {
  id:             string;
  display_id:     string;
  username:       string;
  first_name:     string;
  last_name:      string;
  alias:          string;
  department:     string;
  access_flags:   string[];
  session_status: string;
}

interface UserRow {
  id:             string;
  email:          string;
  emailConfirmed: boolean;
  createdAt:      string;
  lastSignIn:     string | null;
  profile:        UserProfile | null;
  roles:          Role[];
}

// ─── Constants ────────────────────────────────────────────────

const DEPARTMENTS = [
  "Core Systems", "Operations", "Engineering",
  "Security", "Infrastructure", "Research", "Unassigned",
];

const STATUS_COLOR: Record<string, string> = {
  ONLINE:  "bg-zk-green shadow-glow-sm",
  AWAY:    "bg-zk-amber",
  OFFLINE: "bg-zk-muted/40",
};

function blankForm() {
  return {
    email:          "",
    password:       "",
    firstName:      "",
    lastName:       "",
    username:       "",
    displayId:      "",

    department:     "Unassigned",

    accessFlags:    [] as string[],
    roleIds:        [] as string[],
  };
}

// ─── Field ────────────────────────────────────────────────────
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block font-mono text-[10px] text-zk-muted/60 tracking-widest uppercase mb-1.5">
        {label}{required && <span className="text-zk-green ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      autoComplete="off" spellCheck={false}
      className={cn(
        "w-full px-3 py-2 rounded-sm border bg-zk-surface/60 border-zk-border",
        "font-mono text-xs text-zk-white placeholder:text-zk-muted/40",
        "outline-none focus:border-zk-green/60 transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
    />
  );
}

function SelectField({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full px-3 py-2 rounded-sm border bg-zk-surface/60 border-zk-border",
        "font-mono text-xs text-zk-white outline-none focus:border-zk-green/60 transition-colors"
      )}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function UsersPage() {
  const profile     = useProfile();
  const actorFlags  = profile.accessFlags;
  const isModerator = actorFlags.includes("moderator") && !actorFlags.includes("admin") && !isFounder(actorFlags);
  const canCreate   = canCreateUsers(actorFlags);
  const canDelete   = canDeleteUsers(actorFlags);
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles,       setRoles]       = useState<Role[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<UserRow | null>(null);
  const [mode,        setMode]        = useState<"create" | "edit" | null>(null);
  const [form,        setForm]        = useState(blankForm());
  const [showPass,    setShowPass]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [status,      setStatus]      = useState<{ type: "ok" | "err"; msg: string } | null>(null);

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

  function openCreate() {
    setSelected(null);
    setForm(blankForm());
    setMode("create");
    setStatus(null);
    setShowPass(false);
  }

  function openEdit(user: UserRow) {
    setSelected(user);
    setForm({
      email:          user.email,
      password:       "",
      firstName:      user.profile?.first_name  ?? "",
      lastName:       user.profile?.last_name   ?? "",
      username:       user.profile?.username    ?? "",
      displayId:      user.profile?.display_id  ?? "",

      department:     user.profile?.department      ?? "Unassigned",

      accessFlags:    user.profile?.access_flags ?? [],
      roleIds:        user.roles?.map((r) => r.id)  ?? [],
    });
    setMode("edit");
    setStatus(null);
    setShowPass(false);
  }

  function toggleFlag(flag: string) {
    setForm((prev) => ({
      ...prev,
      accessFlags: prev.accessFlags.includes(flag)
        ? prev.accessFlags.filter((f) => f !== flag)
        : [...prev.accessFlags, flag],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      if (mode === "create") {
        const res  = await fetch("/api/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, roleIds: form.roleIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create user.");
        setStatus({ type: "ok", msg: "User created." });
        await fetchAll();
        setMode(null);
      } else if (mode === "edit" && selected) {
        const res  = await fetch(`/api/users/${selected.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName, lastName: form.lastName,
            username: form.username, displayId: form.displayId,
            department: form.department,
            accessFlags: form.accessFlags,
            roleIds: form.roleIds,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to update user.");
        setStatus({ type: "ok", msg: "User updated." });
        await fetchAll();
      }
    } catch (e) {
      setStatus({ type: "err", msg: e instanceof Error ? e.message : "Unknown error." });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res  = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setStatus({ type: "err", msg: data.error ?? "Delete failed." });
    } else {
      if (selected?.id === id) { setSelected(null); setMode(null); }
      await fetchAll();
    }
    setDeleting(null);
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── User list ─────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-zk-border bg-zk-surface/30">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zk-border shrink-0">
          <div className="flex items-center gap-2">
            <Users size={13} className="text-zk-green" />
            <span className="font-mono text-[11px] font-semibold text-zk-green tracking-widest uppercase">Users</span>
            <span className="font-mono text-[9px] text-zk-muted/50">({users.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchAll} className="text-zk-muted/50 hover:text-zk-green transition-colors p-1">
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
            {canCreate && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1 px-2 py-1 rounded-sm border font-mono text-[9px] text-zk-green border-zk-green/30 bg-zk-green/5 hover:bg-zk-green/15 hover:border-zk-green/60 transition-all"
              >
                <UserPlus size={10} /> New
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-zk-border/30 animate-pulse">
                  <div className="h-2.5 bg-zk-green/10 rounded w-1/2 mb-2" />
                  <div className="h-2 bg-zk-green/5 rounded w-3/4" />
                </div>
              ))
            : users.map((user) => {
                const isActive     = mode === "edit" && selected?.id === user.id;
                const st           = user.profile?.session_status ?? "OFFLINE";
                const name         = user.profile
                  ? `${user.profile.first_name} ${user.profile.last_name}`.trim() || user.profile.username
                  : user.email.split("@")[0];
                const isAdmin      = user.profile?.access_flags?.includes("Administrator");
                const assignedRoles = user.roles ?? [];

                return (
                  <button
                    key={user.id}
                    onClick={() => openEdit(user)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-zk-border/30 transition-all duration-150",
                      isActive ? "bg-zk-green/8 border-l-2 border-l-zk-green" : "border-l-2 border-l-transparent hover:bg-zk-green/4"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_COLOR[st] ?? STATUS_COLOR.OFFLINE)} />
                      <span className="font-mono text-[11px] text-zk-white font-medium truncate flex-1">{name}</span>
                      {isAdmin && <ShieldCheck size={10} className="text-zk-green shrink-0" />}
                    </div>
                    <p className="font-mono text-[10px] text-zk-muted/50 truncate pl-3.5">
                      {user.profile?.display_id ?? "—"} · {user.email}
                    </p>
                    <p className="font-mono text-[9px] text-zk-muted/40 truncate pl-3.5 mt-0.5">
                      {assignedRoles.length > 0 ? assignedRoles.map((r) => r.name).join(", ") : user.profile?.department ?? "No profile"}
                    </p>
                  </button>
                );
              })
          }
        </div>
      </div>

      {/* ── Form panel ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg overflow-hidden">
        <AnimatePresence mode="wait">
          {mode ? (
            <motion.div
              key={mode === "create" ? "create" : selected?.id}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zk-border bg-zk-surface/20">
                <div className="flex items-center gap-2">
                  {mode === "create"
                    ? <><UserPlus size={13} className="text-zk-green" /><span className="font-mono text-[11px] font-semibold text-zk-green tracking-widest uppercase">Create User</span></>
                    : <><Edit3 size={13} className="text-zk-green" /><span className="font-mono text-[11px] font-semibold text-zk-green tracking-widest uppercase">Edit User</span></>
                  }
                </div>
                <div className="flex items-center gap-2">
                  {mode === "edit" && selected && canDelete && (
                    <button
                      onClick={() => handleDelete(selected.id)}
                      disabled={!!deleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border font-mono text-[10px] border-zk-red/30 bg-zk-red/5 text-zk-red hover:bg-zk-red/15 hover:border-zk-red/60 disabled:opacity-40 transition-all"
                    >
                      {deleting === selected.id
                        ? <span className="w-3 h-3 border border-zk-red border-t-transparent rounded-full animate-spin" />
                        : <Trash2 size={11} />}
                      Delete
                    </button>
                  )}
                  <button onClick={() => { setMode(null); setSelected(null); setStatus(null); }} className="text-zk-muted hover:text-zk-white transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                {/* Status */}
                <AnimatePresence>
                  {status && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-sm border font-mono text-[11px]",
                        status.type === "ok" ? "border-zk-green/20 bg-zk-green/5 text-zk-green" : "border-zk-red/20 bg-zk-red/5 text-zk-red"
                      )}
                    >
                      {status.type === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {status.msg}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" required>
                    <Input value={form.firstName} onChange={(v) => setForm((p) => ({ ...p, firstName: v }))} placeholder="Zakariya" />
                  </Field>
                  <Field label="Last Name">
                    <Input value={form.lastName} onChange={(v) => setForm((p) => ({ ...p, lastName: v }))} placeholder="Jabbar" />
                  </Field>
                  <Field label="Username" required>
                    <Input value={form.username} onChange={(v) => setForm((p) => ({ ...p, username: v }))} placeholder="zeko" />
                  </Field>
                  <Field label="Display ID">
                    <Input value={form.displayId} onChange={(v) => setForm((p) => ({ ...p, displayId: v }))} placeholder="root-1" />
                  </Field>
                  <Field label="Email" required>
                    <Input value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="user@zeko.os" type="email" disabled={mode === "edit"} />
                  </Field>
                  <Field label={mode === "edit" ? "New Password (optional)" : "Password"} required={mode === "create"}>
                    <div className="relative">
                      <Input value={form.password} onChange={(v) => setForm((p) => ({ ...p, password: v }))} placeholder="min. 8 characters" type={showPass ? "text" : "password"} />
                      <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zk-muted/50 hover:text-zk-green transition-colors">
                        {showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">

                  <Field label="Department">
                    <SelectField value={form.department} onChange={(v) => setForm((p) => ({ ...p, department: v }))} options={DEPARTMENTS} />
                  </Field>

                  {/* Roles — admin/Administrator only */}
                  {!isModerator && (
                    <Field label="Roles">
                      {roles.length === 0 ? (
                        <p className="font-mono text-[10px] text-zk-muted/40 italic mt-1">No roles defined yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {roles.map((r) => {
                            const active = form.roleIds.includes(r.id);
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setForm((p) => ({
                                  ...p,
                                  roleIds: active
                                    ? p.roleIds.filter((id) => id !== r.id)
                                    : [...p.roleIds, r.id],
                                }))}
                                className={cn(
                                  "font-mono text-[9px] px-2.5 py-1 rounded-sm border tracking-widest transition-all duration-150",
                                  active
                                    ? "border-zk-green/60 bg-zk-green/15 text-zk-green"
                                    : "border-zk-border/50 bg-transparent text-zk-muted/50 hover:text-zk-slate hover:border-zk-border"
                                )}
                              >
                                {r.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </Field>
                  )}
                </div>

                {/* Permissions — admin/Administrator only */}
                {!isModerator && (
                <Field label="Permissions">
                  {permissions.length === 0 ? (
                    <p className="font-mono text-[10px] text-zk-muted/40 italic mt-1">
                      No permissions defined yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {permissions.map((perm) => {
                        const active = form.accessFlags.includes(perm.name);
                        return (
                          <button
                            key={perm.id}
                            type="button"
                            onClick={() => toggleFlag(perm.name)}
                            title={perm.description}
                            className={cn(
                              "font-mono text-[9px] px-2.5 py-1 rounded-sm border tracking-widest transition-all duration-150",
                              active
                                ? "border-zk-green/60 bg-zk-green/15 text-zk-green"
                                : "border-zk-border/50 bg-transparent text-zk-muted/50 hover:text-zk-slate hover:border-zk-border"
                            )}
                          >
                            {perm.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>
                )}
              </div>

              {/* Save */}
              <div className="shrink-0 px-6 py-4 border-t border-zk-border bg-zk-surface/10 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-sm border font-mono text-xs tracking-wider border-zk-green/40 bg-zk-green/8 text-zk-green hover:bg-zk-green/20 hover:border-zk-green disabled:opacity-40 disabled:pointer-events-none transition-all"
                >
                  {saving
                    ? <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
                    : mode === "create" ? <UserPlus size={13} /> : <CheckCircle2 size={13} />
                  }
                  {saving ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center gap-3">
              <Users size={28} className="text-zk-muted/20" />
              <p className="font-mono text-[11px] text-zk-muted/40 tracking-widest">SELECT A USER OR CREATE NEW</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
