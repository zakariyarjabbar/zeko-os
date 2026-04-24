// app/system/roles/page.tsx
// IAM Control Panel — founder only (ROOT_ACCESS).
// Tab 1: Role manager  — left list / right detail with permission toggles + assigned users.
// Tab 2: Permissions   — full CRUD for the permissions registry (previously API-only).

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Plus, Trash2, Edit3, Save,
  RefreshCw, X, CheckCircle2, AlertCircle,
  Users, Key, Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/components/system/SessionContext";
import { canManageRoles, canManagePermissions, isFounder } from "@/lib/permissions";
import { getAppCache } from "@/lib/app-cache";
import type { CachedRole, CachedPermission } from "@/lib/app-cache";

// ─── Types ────────────────────────────────────────────────────
type Role = CachedRole;
interface AssignedUser {
  id: string; display_id: number; username: string; session_status: string;
}
interface RoleDetail extends Role { users: AssignedUser[]; }
interface Permission  { id: string; name: string; description: string; created_at: string; }

type ActiveTab   = "roles" | "permissions";
type PermMode    = null | "view" | "create" | "edit";
type RoleRightMode = "view" | "edit" | "create";

const STATUS_DOT: Record<string, string> = {
  ONLINE:  "bg-zk-green shadow-glow-sm",
  AWAY:    "bg-zk-amber",
  OFFLINE: "bg-zk-muted/40",
};

// ─── Shared primitives ────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-sans text-xs text-zk-muted/50 uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function InlineInput({
  value, onChange, placeholder, multiline, disabled,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; disabled?: boolean;
}) {
  const cls = cn(
    "w-full px-3 py-2 rounded border bg-zk-surface/60 border-zk-border",
    "font-sans text-sm text-zk-white placeholder:text-zk-muted/30",
    "outline-none focus:border-zk-green/50 transition-colors resize-none",
    "disabled:opacity-40 disabled:cursor-not-allowed",
  );
  if (multiline) {
    return (
      <textarea
        rows={2} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className={cls}
      />
    );
  }
  return (
    <input
      type="text" value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} autoComplete="off" spellCheck={false}
      className={cls}
    />
  );
}

function FieldWrap({ label, children, required }: {
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

// ─── ROLES TAB ────────────────────────────────────────────────
function blankRole() {
  return { name: "", description: "", permissions: [] as string[] };
}

function RolesTab({ permissions, canWrite }: { permissions: Permission[]; canWrite: boolean }) {
  // Start empty — sessionStorage reads happen in useEffect (client-only)
  const [roles,    setRoles]    = useState<Role[]>([]);
  const [detail,   setDetail]   = useState<RoleDetail | null>(null);
  const [mode,     setMode]     = useState<RoleRightMode>("view");
  const [form,     setForm]     = useState(blankRole());
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast,    setToast]    = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const fetchRoles = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res  = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json() as Role[];
        getAppCache().setRoles(data);
        setRoles(data);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Hydrate from sessionStorage → seed state instantly
    getAppCache().hydrate();
    const cachedRoles = getAppCache().getRoles();
    if (cachedRoles) { setRoles(cachedRoles); setLoading(false); }

    fetchRoles(cachedRoles === null);

    const onCacheUpdate = () => {
      const fresh = getAppCache().getRoles();
      if (fresh) setRoles(fresh);
    };
    window.addEventListener("zk:cache:roles", onCacheUpdate);
    return () => window.removeEventListener("zk:cache:roles", onCacheUpdate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectRole(id: string) {
    setToast(null);
    setMode("view");
    const res  = await fetch(`/api/roles/${id}`);
    const data = await res.json() as RoleDetail;
    setDetail(data);
    setForm({ name: data.name, description: data.description, permissions: data.permissions });
  }

  function togglePerm(flag: string) {
    setForm((p) => ({
      ...p,
      permissions: p.permissions.includes(flag)
        ? p.permissions.filter((f) => f !== flag)
        : [...p.permissions, flag],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      if (mode === "create") {
        const res  = await fetch("/api/roles", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await fetchRoles();
        await selectRole(data.id);
        setToast({ type: "ok", msg: `Role "${form.name}" created.` });
      } else if (mode === "edit" && detail) {
        const res  = await fetch(`/api/roles/${detail.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await fetchRoles();
        await selectRole(detail.id);
        setToast({ type: "ok", msg: "Role updated." });
      }
    } catch (e) {
      setToast({ type: "err", msg: e instanceof Error ? e.message : "Unknown error." });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!detail) return;
    setDeleting(true);
    const res  = await fetch(`/api/roles/${detail.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "err", msg: data.error });
    } else {
      setDetail(null);
      setMode("view");
      await fetchRoles();
    }
    setDeleting(false);
  }

  function openCreate() {
    setDetail(null);
    setForm(blankRole());
    setMode("create");
    setToast(null);
  }

  const isEditing = mode === "edit" || mode === "create";

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Role list */}
      <div className="w-60 shrink-0 flex flex-col border-r border-zk-border/50 bg-zk-surface/15">

        <div className="flex items-center justify-between px-3 py-3 border-b border-zk-border/30 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={12} className="text-zk-green" />
            <span className="font-sans text-sm font-semibold text-zk-white">Roles</span>
            <span className="font-sans text-xs text-zk-muted/35">({roles.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchRoles(true)} className="p-1 text-zk-muted/35 hover:text-zk-green transition-colors">
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
            {canWrite && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1 px-2 py-1 rounded-sm border font-sans text-xs text-zk-green border-zk-green/25 bg-zk-green/5 hover:bg-zk-green/12 hover:border-zk-green/50 transition-all"
              >
                <Plus size={9} /> New
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-4 border-b border-zk-border/15 animate-pulse">
                  <div className="h-2.5 bg-zk-green/8 rounded w-1/2 mb-2" />
                  <div className="h-2 bg-zk-green/4 rounded w-3/4 mb-1.5" />
                  <div className="h-2 bg-zk-green/3 rounded w-1/3" />
                </div>
              ))
            : roles.map((role) => {
                const active = detail?.id === role.id && mode !== "create";
                return (
                  <button
                    key={role.id}
                    onClick={() => selectRole(role.id)}
                    className={cn(
                      "w-full text-left px-4 py-3.5 border-b border-zk-border/15 border-l-2",
                      "transition-all duration-150",
                      active
                        ? "bg-zk-green/[0.04] border-l-zk-green"
                        : "border-l-transparent hover:bg-zk-green/[0.02] hover:border-l-zk-green/25",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck size={11} className={active ? "text-zk-green" : "text-zk-muted/40"} />
                      <span className={cn(
                        "font-sans text-sm font-semibold truncate",
                        active ? "text-zk-green" : "text-zk-white",
                      )}>
                        {role.name}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-zk-muted/40 line-clamp-1 pl-5">
                      {role.description || "No description"}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 pl-5">
                      <span className="flex items-center gap-1 font-sans text-xs text-zk-muted/30">
                        <Users size={8} />
                        {role.userCount} {role.userCount === 1 ? "user" : "users"}
                      </span>
                      <span className="font-sans text-xs text-zk-muted/25">
                        {role.permissions.length} perms
                      </span>
                    </div>
                  </button>
                );
              })
          }
          {!loading && roles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <ShieldCheck size={18} className="text-zk-muted/15" />
              <p className="font-sans text-xs text-zk-muted/25">No roles yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Role detail / form */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg overflow-hidden">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className={cn(
                "shrink-0 flex items-center gap-2 px-5 py-2 border-b font-sans text-sm",
                toast.type === "ok"
                  ? "border-zk-green/15 bg-zk-green/5 text-zk-green"
                  : "border-zk-red/15 bg-zk-red/5 text-zk-red",
              )}
            >
              {toast.type === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {toast.msg}
              <button onClick={() => setToast(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity">
                <X size={11} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {(detail || mode === "create") ? (
            <motion.div
              key={mode === "create" ? "create" : detail?.id}
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
              className="flex flex-col h-full"
            >
              {/* Panel header */}
              <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zk-border/50 bg-zk-surface/15">
                <div className="flex items-center gap-2">
                  {isEditing
                    ? <><Edit3 size={13} className="text-zk-green" /><span className="font-sans text-sm font-semibold text-zk-white">{mode === "create" ? "New Role" : "Edit Role"}</span></>
                    : <><ShieldCheck size={13} className="text-zk-green" /><span className="font-sans text-sm font-semibold text-zk-white">{detail?.name}</span></>
                  }
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && detail && canWrite && (
                    <>
                      <button
                        onClick={() => { setMode("edit"); setToast(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border font-sans text-sm border-zk-border/50 text-zk-slate hover:text-zk-white hover:border-zk-green/30 transition-all"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
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
                    </>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => {
                        if (mode === "create") { setDetail(null); setMode("view"); }
                        else if (detail) {
                          setMode("view");
                          setForm({ name: detail.name, description: detail.description, permissions: detail.permissions });
                        }
                        setToast(null);
                      }}
                      className="text-zk-muted/40 hover:text-zk-white transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* Name + description */}
                <div className="space-y-4">
                  <div>
                    <SectionLabel>role name</SectionLabel>
                    {isEditing ? (
                      <FieldWrap label="Name" required>
                        <InlineInput
                          value={form.name}
                          onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                          placeholder="e.g. Operator"
                        />
                      </FieldWrap>
                    ) : (
                      <div className="flex items-center gap-3">
                        <ShieldCheck size={18} className="text-zk-green/60" />
                        <span className="font-mono text-xl font-bold text-zk-white">{detail?.name}</span>
                        <span className="font-sans text-xs text-zk-muted/30 ml-1">
                          {detail?.permissions.length} permissions · {detail?.userCount} users
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <SectionLabel>description</SectionLabel>
                    {isEditing ? (
                      <FieldWrap label="Description">
                        <InlineInput
                          multiline
                          value={form.description}
                          onChange={(v) => setForm((p) => ({ ...p, description: v }))}
                          placeholder="What does this role allow?"
                        />
                      </FieldWrap>
                    ) : (
                      <p className="font-sans text-sm text-zk-slate leading-relaxed">
                        {detail?.description || <span className="text-zk-muted/25 italic">No description</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Permissions checklist */}
                <div>
                  <SectionLabel>permissions</SectionLabel>
                  {permissions.length === 0 ? (
                    <div className="px-4 py-8 rounded-sm border border-dashed border-zk-border/25 text-center">
                      <p className="font-sans text-xs text-zk-muted/25">No permissions defined</p>
                      <p className="font-sans text-xs text-zk-muted/20 mt-1">Add them in the Permissions tab</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {permissions.map((perm) => {
                        const active = isEditing
                          ? form.permissions.includes(perm.id)
                          : (detail?.permissions ?? []).includes(perm.id);

                        return (
                          <div
                            key={perm.id}
                            onClick={() => isEditing && togglePerm(perm.id)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 rounded-sm border",
                              "transition-all duration-150",
                              isEditing && "cursor-pointer",
                              active
                                ? "border-zk-green/25 bg-zk-green/[0.07]"
                                : "border-zk-border/25 bg-zk-surface/15",
                              isEditing && !active && "hover:border-zk-border/50 hover:bg-zk-surface/30",
                            )}
                          >
                            {/* Checkbox */}
                            <div className={cn(
                              "w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0",
                              "transition-all duration-150",
                              active ? "border-zk-green bg-zk-green" : "border-zk-muted/25 bg-transparent",
                            )}>
                              {active && (
                                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="#050505" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <span className={cn(
                                "font-mono text-xs",
                                active ? "text-zk-green" : "text-zk-muted/45",
                              )}>
                                {perm.name}
                              </span>
                              {perm.description && (
                                <p className="font-sans text-xs text-zk-muted/30 mt-0.5">{perm.description}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Assigned users — view only */}
                {!isEditing && detail && (
                  <div>
                    <SectionLabel>assigned users ({detail.users.length})</SectionLabel>
                    {detail.users.length === 0 ? (
                      <div className="px-4 py-4 rounded-sm border border-dashed border-zk-border/20 text-center">
                        <p className="font-sans text-xs text-zk-muted/25">No users assigned</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.users.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-sm border border-zk-border/20 bg-zk-surface/15"
                          >
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              STATUS_DOT[u.session_status] ?? STATUS_DOT.OFFLINE,
                            )} />
                            <span className="font-sans text-sm text-zk-white">
                              {u.username}
                            </span>
                            <span className="font-sans text-xs text-zk-muted/45">@{u.username}</span>
                            <span className="ml-auto font-mono text-xs text-zk-green/50">#{u.display_id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Save bar */}
              {isEditing && (
                <div className="shrink-0 px-6 py-4 border-t border-zk-border/40 bg-zk-surface/10 flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (mode === "create") { setDetail(null); setMode("view"); }
                      else if (detail) {
                        setMode("view");
                        setForm({ name: detail.name, description: detail.description, permissions: detail.permissions });
                      }
                      setToast(null);
                    }}
                    className="font-sans text-sm text-zk-muted/40 hover:text-zk-slate transition-colors"
                  >
                    ← Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.name.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded border font-sans text-sm font-medium border-zk-green/35 bg-zk-green/8 text-zk-green hover:bg-zk-green/18 hover:border-zk-green/60 disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    {saving
                      ? <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
                      : mode === "create" ? <Plus size={13} /> : <Save size={13} />}
                    {saving ? "Saving..." : mode === "create" ? "Create Role" : "Save Changes"}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty-role"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-16 h-16 rounded-sm border border-zk-border/15 bg-zk-green/[0.02] flex items-center justify-center">
                <ShieldCheck size={24} className="text-zk-green/20" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-sans text-sm text-zk-muted/30">Select a role or create new</p>
                <p className="font-sans text-xs text-zk-muted/20">define access boundaries for your team</p>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 rounded border font-sans text-sm font-medium border-zk-green/25 bg-zk-green/5 text-zk-green/60 hover:text-zk-green hover:bg-zk-green/12 hover:border-zk-green/40 transition-all"
              >
                <Plus size={12} /> New Role
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── PERMISSIONS TAB ──────────────────────────────────────────
function blankPerm() {
  return { name: "", description: "" };
}

function PermissionsTab({ canWrite }: { canWrite: boolean }) {
  const cachedPermissions = getAppCache().getPermissions() as Permission[] | null;

  const [perms,    setPerms]    = useState<Permission[]>(cachedPermissions ?? []);
  const [selected, setSelected] = useState<Permission | null>(null);
  const [mode,     setMode]     = useState<PermMode>(null);
  const [form,     setForm]     = useState(blankPerm());
  const [loading,  setLoading]  = useState(cachedPermissions === null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast,    setToast]    = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Returns the freshly-fetched list so callers can act on it without a second fetch.
  const fetchPerms = useCallback(async (showSpinner = false): Promise<Permission[]> => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch("/api/permissions");
      if (res.ok) {
        const data = await res.json() as Permission[];
        getAppCache().setPermissions(data as CachedPermission[]);
        setPerms(data);
        return data;
      }
    } finally { setLoading(false); }
    return [];
  }, []);

  useEffect(() => {
    // Stale-while-revalidate: show cached data instantly, always fetch fresh on mount.
    fetchPerms(cachedPermissions === null);

    // Pick up background refreshes triggered by ShellPrefetcher's 3-min interval.
    const onCacheUpdate = () => {
      const fresh = getAppCache().getPermissions() as Permission[] | null;
      if (fresh) setPerms(fresh);
    };
    window.addEventListener("zk:cache:permissions", onCacheUpdate);
    return () => window.removeEventListener("zk:cache:permissions", onCacheUpdate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openView(perm: Permission) {
    setSelected(perm);
    setMode("view");
    setForm({ name: perm.name, description: perm.description });
    setToast(null);
  }

  function openCreate() {
    setSelected(null);
    setForm(blankPerm());
    setMode("create");
    setToast(null);
  }

  function openEdit(perm: Permission) {
    setSelected(perm);
    setForm({ name: perm.name, description: perm.description });
    setMode("edit");
    setToast(null);
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      if (mode === "create") {
        const res  = await fetch("/api/permissions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setToast({ type: "ok", msg: `Permission "${form.name}" created.` });
        await fetchPerms();
        setMode(null);
        setSelected(null);
      } else if (mode === "edit" && selected) {
        const res  = await fetch(`/api/permissions/${selected.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setToast({ type: "ok", msg: "Permission updated." });
        const freshList = await fetchPerms();
        const fresh = freshList.find((p) => p.id === selected.id);
        if (fresh) { setSelected(fresh); setMode("view"); }
      }
    } catch (e) {
      setToast({ type: "err", msg: e instanceof Error ? e.message : "Unknown error." });
    } finally { setSaving(false); }
  }

  async function handleDelete(perm: Permission) {
    setDeleting(true);
    const res  = await fetch(`/api/permissions/${perm.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "err", msg: data.error });
    } else {
      if (selected?.id === perm.id) { setSelected(null); setMode(null); }
      await fetchPerms();
    }
    setDeleting(false);
  }

  const isEditing = mode === "edit" || mode === "create";

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Permission list */}
      <div className="w-60 shrink-0 flex flex-col border-r border-zk-border/50 bg-zk-surface/15">

        <div className="flex items-center justify-between px-3 py-3 border-b border-zk-border/30 shrink-0">
          <div className="flex items-center gap-2">
            <Key size={12} className="text-zk-green" />
            <span className="font-sans text-sm font-semibold text-zk-white">Permissions</span>
            <span className="font-sans text-xs text-zk-muted/35">({perms.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchPerms()} className="p-1 text-zk-muted/35 hover:text-zk-green transition-colors">
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
            {canWrite && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1 px-2 py-1 rounded-sm border font-sans text-xs text-zk-green border-zk-green/25 bg-zk-green/5 hover:bg-zk-green/12 hover:border-zk-green/50 transition-all"
              >
                <Plus size={9} /> New
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 border-b border-zk-border/15 animate-pulse">
                  <div className="h-2.5 bg-zk-green/8 rounded w-2/3 mb-2" />
                  <div className="h-2 bg-zk-green/4 rounded w-5/6" />
                </div>
              ))
            : perms.map((perm) => {
                const isActive = selected?.id === perm.id && mode !== "create";
                return (
                  <div
                    key={perm.id}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 border-b border-zk-border/15 border-l-2 group",
                      "transition-all duration-150 cursor-pointer",
                      isActive
                        ? "bg-zk-green/[0.04] border-l-zk-green"
                        : "border-l-transparent hover:bg-zk-green/[0.02] hover:border-l-zk-green/25",
                    )}
                    onClick={() => openView(perm)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Key size={9} className={isActive ? "text-zk-green/70" : "text-zk-muted/30"} />
                        <span className={cn(
                          "font-mono text-xs truncate",
                          isActive ? "text-zk-green" : "text-zk-white",
                        )}>
                          {perm.name}
                        </span>
                      </div>
                      {perm.description && (
                        <p className="font-sans text-xs text-zk-muted/35 line-clamp-1 pl-4">
                          {perm.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
          }
          {!loading && perms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Key size={18} className="text-zk-muted/15" />
              <p className="font-sans text-xs text-zk-muted/25">No permissions yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Permission detail / form */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg overflow-hidden">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className={cn(
                "shrink-0 flex items-center gap-2 px-5 py-2 border-b font-sans text-sm",
                toast.type === "ok"
                  ? "border-zk-green/15 bg-zk-green/5 text-zk-green"
                  : "border-zk-red/15 bg-zk-red/5 text-zk-red",
              )}
            >
              {toast.type === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {toast.msg}
              <button onClick={() => setToast(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity">
                <X size={11} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {mode === "create" || (mode && selected) ? (
            <motion.div
              key={mode === "create" ? "perm-create" : `perm-${selected?.id}-${mode}`}
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zk-border/50 bg-zk-surface/15">
                <div className="flex items-center gap-2">
                  <Key size={13} className="text-zk-green" />
                  <span className="font-sans text-sm font-semibold text-zk-white">
                    {mode === "create" ? "New Permission" : mode === "edit" ? "Edit Permission" : selected?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {mode === "view" && selected && canWrite && (
                    <>
                      <button
                        onClick={() => openEdit(selected)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border font-sans text-sm border-zk-border/50 text-zk-slate hover:text-zk-white hover:border-zk-green/30 transition-all"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(selected)}
                        disabled={deleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border font-sans text-sm border-zk-red/25 bg-zk-red/5 text-zk-red hover:bg-zk-red/12 hover:border-zk-red/50 disabled:opacity-40 transition-all"
                      >
                        {deleting
                          ? <span className="w-3 h-3 border border-zk-red border-t-transparent rounded-full animate-spin" />
                          : <Trash2 size={11} />}
                        Delete
                      </button>
                    </>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => {
                        if (mode === "create") { setMode(null); setSelected(null); }
                        else if (selected) openView(selected);
                        setToast(null);
                      }}
                      className="text-zk-muted/40 hover:text-zk-white transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                  {mode === "view" && (
                    <button
                      onClick={() => { setSelected(null); setMode(null); }}
                      className="text-zk-muted/40 hover:text-zk-white transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* Name */}
                <div>
                  <SectionLabel>permission name</SectionLabel>
                  {isEditing ? (
                    <FieldWrap label="Name" required>
                      <InlineInput
                        value={form.name}
                        onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                        placeholder="e.g. deploy"
                      />
                    </FieldWrap>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Key size={18} className="text-zk-green/50" />
                      <span className="font-mono text-xl font-bold text-zk-white">{selected?.name}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <SectionLabel>description</SectionLabel>
                  {isEditing ? (
                    <FieldWrap label="Description">
                      <InlineInput
                        multiline
                        value={form.description}
                        onChange={(v) => setForm((p) => ({ ...p, description: v }))}
                        placeholder="What does this permission grant access to?"
                      />
                    </FieldWrap>
                  ) : (
                    <p className="font-sans text-sm text-zk-slate leading-relaxed">
                      {selected?.description || <span className="text-zk-muted/25 italic">No description</span>}
                    </p>
                  )}
                </div>

                {/* System meta — view only */}
                {mode === "view" && selected && (
                  <div>
                    <SectionLabel>system</SectionLabel>
                    <div className="space-y-2">
                      <div className="grid grid-cols-[7rem_1fr] gap-2 py-2 border-b border-zk-border/10">
                        <span className="font-sans text-xs text-zk-muted/35">Permission ID</span>
                        <span className="font-mono text-xs text-zk-muted/50 break-all">{selected.id}</span>
                      </div>
                      <div className="grid grid-cols-[7rem_1fr] gap-2 py-2 border-b border-zk-border/10">
                        <span className="font-sans text-xs text-zk-muted/35">Created</span>
                        <span className="font-mono text-xs text-zk-muted/50">
                          {new Date(selected.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Save bar */}
              {isEditing && (
                <div className="shrink-0 px-6 py-4 border-t border-zk-border/40 bg-zk-surface/10 flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (mode === "create") { setMode(null); setSelected(null); }
                      else if (selected) openView(selected);
                      setToast(null);
                    }}
                    className="font-sans text-sm text-zk-muted/40 hover:text-zk-slate transition-colors"
                  >
                    ← Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.name.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded border font-sans text-sm font-medium border-zk-green/35 bg-zk-green/8 text-zk-green hover:bg-zk-green/18 hover:border-zk-green/60 disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    {saving
                      ? <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
                      : mode === "create" ? <Plus size={13} /> : <Save size={13} />}
                    {saving ? "Saving..." : mode === "create" ? "Create Permission" : "Save Changes"}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty-perm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-16 h-16 rounded-sm border border-zk-border/15 bg-zk-green/[0.02] flex items-center justify-center">
                <Key size={24} className="text-zk-green/20" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-sans text-sm text-zk-muted/30">Select a permission or create new</p>
                <p className="font-sans text-xs text-zk-muted/20">granular access keys assigned to roles</p>
              </div>
              {canWrite && (
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2 rounded border font-sans text-sm font-medium border-zk-green/25 bg-zk-green/5 text-zk-green/60 hover:text-zk-green hover:bg-zk-green/12 hover:border-zk-green/40 transition-all"
                >
                  <Plus size={12} /> New Permission
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Root page: IAM Control Panel ─────────────────────────────
export default function IAMPage() {
  const profile        = useProfile();
  const actorIds       = profile.accessFlags;
  const isAdmin        = isFounder(actorIds);
  const canRoles       = isAdmin || canManageRoles(actorIds);
  const canPerms       = isAdmin || canManagePermissions(actorIds);

  const defaultTab: ActiveTab = canRoles ? "roles" : "permissions";
  const [activeTab,   setActiveTab]   = useState<ActiveTab>(defaultTab);
  // Start empty so SSR and client initial render match
  const [perms,       setPerms]       = useState<Permission[]>([]);
  const [permsLoaded, setPermsLoaded] = useState(false);

  useEffect(() => {
    // Hydrate from sessionStorage → seed instantly
    getAppCache().hydrate();
    const cached = getAppCache().getPermissions() as Permission[] | null;
    if (cached) { setPerms(cached); setPermsLoaded(true); }
    // Always revalidate on mount
    fetch("/api/permissions")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Permission[]) => {
        getAppCache().setPermissions(data as CachedPermission[]);
        setPerms(data);
        setPermsLoaded(true);
      });
  }, []);

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    ...(canRoles ? [{ id: "roles" as ActiveTab,       label: "Roles",       icon: ShieldCheck }] : []),
    ...(canPerms ? [{ id: "permissions" as ActiveTab, label: "Permissions", icon: Key         }] : []),
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Stats ribbon ───────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-5 h-8 border-b border-zk-border/40 bg-zk-surface/10">
        <Terminal size={10} className="text-zk-green/40 shrink-0" />
        <span className="font-sans text-xs text-zk-muted/40">IAM Control Panel</span>
        <span className="text-zk-border/60">·</span>
        <span className="font-sans text-xs text-zk-muted/35">
          {permsLoaded ? `${perms.length} permissions defined` : "loading..."}
        </span>
        <div className="ml-auto font-sans text-xs text-zk-muted/25">Root access required</div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-0 px-4 border-b border-zk-border/40 bg-zk-surface/8">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 border-b-2 font-sans text-sm font-medium",
              "transition-all duration-150",
              activeTab === id
                ? "border-zk-green text-zk-green"
                : "border-transparent text-zk-muted/40 hover:text-zk-slate hover:border-zk-border",
            )}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
          className="flex flex-1 overflow-hidden"
        >
          {activeTab === "roles"
            ? <RolesTab permissions={perms} canWrite={canRoles} />
            : <PermissionsTab canWrite={canPerms} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
