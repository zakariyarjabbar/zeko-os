// app/system/roles/page.tsx
// Role Manager — founder only (ROOT_ACCESS).
// Left: role list. Right: role detail with permission toggles + assigned users.

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Plus, Trash2, Edit3, Save,
  RefreshCw, X, CheckCircle2, AlertCircle, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface Role {
  id:          string;
  name:        string;
  description: string;
  permissions: string[];
  created_at:  string;
  userCount:   number;
}

interface AssignedUser {
  id:             string;
  display_id:     string;
  username:       string;
  first_name:     string;
  last_name:      string;
  session_status: string;
}

interface RoleDetail extends Role {
  users: AssignedUser[];
}

// ─── Permission type ──────────────────────────────────────────
interface Permission {
  id:          string;
  name:        string;
  description: string;
}

const STATUS_DOT: Record<string, string> = {
  ONLINE:  "bg-zk-green shadow-glow-sm",
  AWAY:    "bg-zk-amber",
  OFFLINE: "bg-zk-muted/40",
};

function blankForm() {
  return { name: "", description: "", permissions: [] as string[] };
}

// ─── Component ────────────────────────────────────────────────
export default function RolesPage() {
  const [roles,       setRoles]       = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [detail,      setDetail]      = useState<RoleDetail | null>(null);
  const [mode,        setMode]        = useState<"view" | "edit" | "create">("view");
  const [form,        setForm]        = useState(blankForm());
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [status,      setStatus]      = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // ── Fetch roles + permissions ──────────────────────────────
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/permissions"),
      ]);
      if (rRes.ok) setRoles(await rRes.json());
      if (pRes.ok) setPermissions(await pRes.json());
    } catch (e) { console.error("[roles]", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  // ── Select role ────────────────────────────────────────────
  async function selectRole(id: string) {
    setStatus(null);
    setMode("view");
    const res  = await fetch(`/api/roles/${id}`);
    const data = await res.json() as RoleDetail;
    setDetail(data);
    setForm({ name: data.name, description: data.description, permissions: data.permissions });
  }

  // ── Toggle permission ──────────────────────────────────────
  function toggleFlag(flag: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(flag)
        ? prev.permissions.filter((f) => f !== flag)
        : [...prev.permissions, flag],
    }));
  }

  // ── Save ───────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      if (mode === "create") {
        const res  = await fetch("/api/roles", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStatus({ type: "ok", msg: `Role "${form.name}" created.` });
        await fetchRoles();
        // Auto-select the new role
        selectRole(data.id);
        setMode("view");
      } else if (mode === "edit" && detail) {
        const res  = await fetch(`/api/roles/${detail.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStatus({ type: "ok", msg: "Role updated." });
        await fetchRoles();
        await selectRole(detail.id);
        setMode("view");
      }
    } catch (e) {
      setStatus({ type: "err", msg: e instanceof Error ? e.message : "Unknown error." });
    } finally { setSaving(false); }
  }

  // ── Delete ─────────────────────────────────────────────────
  async function handleDelete() {
    if (!detail) return;
    setDeleting(true);
    const res  = await fetch(`/api/roles/${detail.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setStatus({ type: "err", msg: data.error });
      setDeleting(false);
      return;
    }
    setDetail(null);
    setMode("view");
    await fetchRoles();
    setDeleting(false);
  }

  // ── Open create ────────────────────────────────────────────
  function openCreate() {
    setDetail(null);
    setForm(blankForm());
    setMode("create");
    setStatus(null);
  }

  const isEditing = mode === "edit" || mode === "create";

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Role list ─────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-zk-border bg-zk-surface/30">

        <div className="flex items-center justify-between px-4 py-3 border-b border-zk-border shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className="text-zk-green" />
            <span className="font-mono text-[11px] font-semibold text-zk-green tracking-widest uppercase">
              Roles
            </span>
            <span className="font-mono text-[9px] text-zk-muted/50">({roles.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchRoles} className="text-zk-muted/50 hover:text-zk-green transition-colors p-1">
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-1 px-2 py-1 rounded-sm border font-mono text-[9px] text-zk-green border-zk-green/30 bg-zk-green/5 hover:bg-zk-green/15 hover:border-zk-green/60 transition-all"
            >
              <Plus size={10} /> New
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="px-4 py-4 border-b border-zk-border/30 animate-pulse">
                  <div className="h-3 bg-zk-green/10 rounded w-1/2 mb-2" />
                  <div className="h-2 bg-zk-green/5 rounded w-3/4" />
                </div>
              ))
            : roles.map((role) => {
                const active = detail?.id === role.id && mode !== "create";
                return (
                  <button
                    key={role.id}
                    onClick={() => selectRole(role.id)}
                    className={cn(
                      "w-full text-left px-4 py-3.5 border-b border-zk-border/30",
                      "transition-all duration-150 group",
                      active
                        ? "bg-zk-green/8 border-l-2 border-l-zk-green"
                        : "border-l-2 border-l-transparent hover:bg-zk-green/4"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck size={11} className={active ? "text-zk-green" : "text-zk-muted/50"} />
                      <span className={cn(
                        "font-mono text-[11px] font-semibold",
                        active ? "text-zk-green" : "text-zk-white"
                      )}>
                        {role.name}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-zk-muted/50 line-clamp-1 pl-5">
                      {role.description || "No description"}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5 pl-5">
                      <Users size={9} className="text-zk-muted/40" />
                      <span className="font-mono text-[9px] text-zk-muted/40">
                        {role.userCount} {role.userCount === 1 ? "user" : "users"}
                      </span>
                      <span className="ml-2 font-mono text-[9px] text-zk-muted/30">
                        {role.permissions.length} perms
                      </span>
                    </div>
                  </button>
                );
              })
          }
        </div>
      </div>

      {/* ── Detail / form panel ───────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg overflow-hidden">
        <AnimatePresence mode="wait">
          {(detail || mode === "create") ? (
            <motion.div
              key={mode === "create" ? "create" : detail?.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col h-full"
            >
              {/* Panel header */}
              <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zk-border bg-zk-surface/20">
                <div className="flex items-center gap-2">
                  {isEditing
                    ? <><Edit3 size={13} className="text-zk-green" /><span className="font-mono text-[11px] font-semibold text-zk-green tracking-widest uppercase">{mode === "create" ? "New Role" : "Edit Role"}</span></>
                    : <><ShieldCheck size={13} className="text-zk-green" /><span className="font-mono text-[11px] font-semibold text-zk-green tracking-widest uppercase">{detail?.name}</span></>
                  }
                </div>

                <div className="flex items-center gap-2">
                  {!isEditing && detail && (
                    <>
                      <button
                        onClick={() => { setMode("edit"); setStatus(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border font-mono text-[10px] border-zk-border text-zk-slate hover:text-zk-white hover:border-zk-green/40 transition-all"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border font-mono text-[10px] border-zk-red/30 bg-zk-red/5 text-zk-red hover:bg-zk-red/15 hover:border-zk-red/60 disabled:opacity-40 transition-all"
                      >
                        {deleting ? <span className="w-3 h-3 border border-zk-red border-t-transparent rounded-full animate-spin" /> : <Trash2 size={11} />}
                        Delete
                      </button>
                    </>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => {
                        if (mode === "create") { setDetail(null); setMode("view"); }
                        else { setMode("view"); setForm({ name: detail!.name, description: detail!.description, permissions: detail!.permissions }); }
                        setStatus(null);
                      }}
                      className="text-zk-muted hover:text-zk-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* Status */}
                <AnimatePresence>
                  {status && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-sm border font-mono text-[11px]",
                        status.type === "ok"
                          ? "border-zk-green/20 bg-zk-green/5 text-zk-green"
                          : "border-zk-red/20 bg-zk-red/5 text-zk-red"
                      )}
                    >
                      {status.type === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {status.msg}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Name + description */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-mono text-[9px] text-zk-muted/50 tracking-[0.2em] uppercase mb-2">
                      // Role Name
                    </label>
                    {isEditing ? (
                      <input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Operator"
                        className="w-full px-3 py-2 rounded-sm border bg-zk-surface/60 border-zk-border font-mono text-sm text-zk-white placeholder:text-zk-muted/40 outline-none focus:border-zk-green/60 transition-colors"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-zk-green" />
                        <span className="font-mono text-lg font-bold text-zk-white">{detail?.name}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[9px] text-zk-muted/50 tracking-[0.2em] uppercase mb-2">
                      // Description
                    </label>
                    {isEditing ? (
                      <textarea
                        rows={2}
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="What does this role do?"
                        className="w-full px-3 py-2 rounded-sm border bg-zk-surface/60 border-zk-border font-mono text-sm text-zk-white placeholder:text-zk-muted/40 outline-none focus:border-zk-green/60 resize-none transition-colors"
                      />
                    ) : (
                      <p className="font-mono text-sm text-zk-slate leading-relaxed">
                        {detail?.description || <span className="text-zk-muted/40 italic">No description</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <label className="block font-mono text-[9px] text-zk-muted/50 tracking-[0.2em] uppercase mb-3">
                    // Permissions
                  </label>
                  {permissions.length === 0 ? (
                    <div className="px-4 py-6 rounded-sm border border-dashed border-zk-border/40 text-center">
                      <p className="font-mono text-[10px] text-zk-muted/30 tracking-widest">
                        NO PERMISSIONS DEFINED YET
                      </p>
                      <p className="font-mono text-[9px] text-zk-muted/20 mt-1">
                        Add permissions from the Permissions section
                      </p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {permissions.map((perm) => {
                      const active = isEditing
                        ? form.permissions.includes(perm.name)
                        : (detail?.permissions ?? []).includes(perm.name);

                      return (
                        <div
                          key={perm.id}
                          onClick={() => isEditing && toggleFlag(perm.name)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-sm border",
                            "transition-all duration-150",
                            isEditing && "cursor-pointer",
                            active
                              ? "border-zk-green/30 bg-zk-green/8"
                              : "border-zk-border/40 bg-zk-surface/20",
                            isEditing && !active && "hover:border-zk-border hover:bg-zk-surface/40",
                          )}
                        >
                          <div className={cn(
                            "w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-all",
                            active ? "border-zk-green bg-zk-green" : "border-zk-muted/30 bg-transparent"
                          )}>
                            {active && (
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="#050505" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <span className={cn("font-mono text-[11px] tracking-widest", active ? "text-zk-green" : "text-zk-muted/50")}>
                              {perm.name}
                            </span>
                            {perm.description && (
                              <p className="font-mono text-[10px] text-zk-muted/40 mt-0.5">{perm.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>

                {/* Assigned users (view mode only) */}
                {!isEditing && detail && detail.users.length > 0 && (
                  <div>
                    <label className="block font-mono text-[9px] text-zk-muted/50 tracking-[0.2em] uppercase mb-3">
                      // Assigned Users ({detail.users.length})
                    </label>
                    <div className="space-y-1.5">
                      {detail.users.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-sm border border-zk-border/30 bg-zk-surface/20"
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[u.session_status] ?? STATUS_DOT.OFFLINE)} />
                          <span className="font-mono text-[11px] text-zk-white">
                            {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.username}
                          </span>
                          <span className="font-mono text-[10px] text-zk-muted/50">@{u.username}</span>
                          <span className="ml-auto font-mono text-[9px] text-zk-green/60">{u.display_id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isEditing && detail && detail.users.length === 0 && (
                  <div className="px-4 py-3 rounded-sm border border-dashed border-zk-border/40 text-center">
                    <p className="font-mono text-[10px] text-zk-muted/30 tracking-widest">NO USERS ASSIGNED</p>
                  </div>
                )}
              </div>

              {/* Save bar */}
              {isEditing && (
                <div className="shrink-0 px-6 py-4 border-t border-zk-border bg-zk-surface/10 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.name.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-sm border font-mono text-xs tracking-wider border-zk-green/40 bg-zk-green/8 text-zk-green hover:bg-zk-green/20 hover:border-zk-green disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    {saving
                      ? <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
                      : mode === "create" ? <Plus size={13} /> : <Save size={13} />
                    }
                    {saving ? "Saving..." : mode === "create" ? "Create Role" : "Save Changes"}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-3"
            >
              <ShieldCheck size={28} className="text-zk-muted/20" />
              <p className="font-mono text-[11px] text-zk-muted/40 tracking-widest">SELECT A ROLE OR CREATE NEW</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
