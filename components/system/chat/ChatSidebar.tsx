// components/system/chat/ChatSidebar.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Plus, Lock, Hash, Trash2, Pencil, Globe, ShieldCheck, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Channel, type DMConversation } from "./types";

const STATUS_DOT: Record<string, string> = {
  ONLINE:  "bg-zk-green shadow-glow-sm",
  AWAY:    "bg-zk-amber",
  OFFLINE: "bg-zk-muted/30",
};

interface SearchResult {
  id:       string;
  username: string;
  name:     string;
  email:    string;
  status:   string;
}

interface PermissionOption {
  id:   string;
  name: string;
  description: string;
}

interface ChannelFormState {
  label:            string;
  topic:            string;
  isPublic:         boolean;
  viewPermission:   string;
  deletePermission: string;
}

const EMPTY_FORM: ChannelFormState = {
  label: "", topic: "", isPublic: true, viewPermission: "", deletePermission: "",
};

interface ChatSidebarProps {
  channels:          Channel[];
  activeChannel:     string;
  onSelect:          (id: string, type: "channel" | "dm", dmUserId?: string, dmHandle?: string) => void;
  dmConvos:          DMConversation[];
  activeDmUser?:     string;
  onRefreshDms:      () => void;
  loadingChannels?:  boolean;
  loadingDms?:       boolean;
  presence?:         Record<string, "ONLINE" | "OFFLINE">;
  isAdmin?:          boolean;
  onCreateChannel?:  (label: string, topic: string, isPublic: boolean, viewPermission: string | null, deletePermission: string | null) => Promise<void>;
  onEditChannel?:    (id: string, label: string, topic: string, isPublic: boolean, viewPermission: string | null, deletePermission: string | null) => Promise<void>;
  onDeleteChannel?:  (channelId: string) => Promise<void>;
}

// ─── Skeletons ────────────────────────────────────────────────
function SkeletonChannels() {
  const widths = ["w-24", "w-20", "w-28", "w-16"];
  return (
    <div className="px-2 flex flex-col gap-px animate-pulse">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-sm border border-transparent">
          <div className="w-3 h-3 rounded-sm bg-zk-border/25 shrink-0" />
          <div className={cn("h-2.5 rounded-sm bg-zk-border/20", w)} />
        </div>
      ))}
    </div>
  );
}

function SkeletonDms() {
  const rows = [{ handle: "w-20", preview: "w-32" }, { handle: "w-16", preview: "w-28" }, { handle: "w-24", preview: "w-20" }];
  return (
    <div className="px-2 flex flex-col gap-px animate-pulse">
      {rows.map((r, i) => (
        <div key={i} className="px-2.5 py-2 rounded-sm border border-transparent">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-zk-border/25 shrink-0" />
            <div className={cn("h-2.5 rounded-sm bg-zk-border/25", r.handle)} />
          </div>
          <div className={cn("h-2 rounded-sm bg-zk-border/15 ml-3.5", r.preview)} />
        </div>
      ))}
    </div>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-5 pb-1.5">
      <span className="font-sans text-xs text-zk-muted/50 uppercase tracking-wide">{children}</span>
      {action}
    </div>
  );
}

// ─── Permission picker ────────────────────────────────────────
function PermPicker({
  value,
  onChange,
  options,
  loading,
  placeholder,
  clearLabel,
}: {
  value:       string;
  onChange:    (v: string) => void;
  options:     PermissionOption[];
  loading:     boolean;
  placeholder: string;
  clearLabel:  string;
}) {
  const [open,   setOpen]   = useState(false);
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const rootRef   = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => filterRef.current?.focus(), 50);
  }, [open]);

  const filtered = filter.trim()
    ? options.filter(
        (p) =>
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.description?.toLowerCase().includes(filter.toLowerCase()),
      )
    : options;

  const selected = options.find((p) => p.name === value);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setFilter("");
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-1.5 rounded border transition-all",
          "font-sans text-xs text-left",
          open
            ? "border-zk-green/40 bg-zk-bg/80"
            : "border-zk-border/40 bg-zk-bg/60 hover:border-zk-border/70",
          loading && "opacity-40 cursor-not-allowed",
        )}
      >
        {selected ? (
          <>
            <ShieldCheck size={10} className="text-zk-green/60 shrink-0" />
            <span className="flex-1 text-zk-white truncate">{selected.name}</span>
          </>
        ) : (
          <>
            <span className="w-2.5 h-2.5 shrink-0" />
            <span className="flex-1 text-zk-muted/35 truncate">{loading ? "Loading..." : placeholder}</span>
          </>
        )}
        <ChevronDown
          size={10}
          className={cn("shrink-0 text-zk-muted/40 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Dropdown panel — renders inline so sidebar overflow doesn't clip it */}
      {open && (
        <div className="mt-1 rounded border border-zk-green/20 bg-[rgba(10,14,20,0.97)] shadow-lg overflow-hidden z-10">
          {/* Search */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-zk-border/30">
            <Search size={9} className="text-zk-muted/40 shrink-0" />
            <input
              ref={filterRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter permissions..."
              className="flex-1 bg-transparent outline-none font-sans text-xs text-zk-white placeholder:text-zk-muted/30 caret-zk-green"
            />
            {filter && (
              <button onClick={() => setFilter("")} className="text-zk-muted/30 hover:text-zk-white shrink-0">
                <X size={9} />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-40 overflow-y-auto scrollbar-thin">
            {/* Clear option */}
            <button
              onClick={() => pick("")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors",
                "border-b border-zk-border/20 hover:bg-zk-green/5",
              )}
            >
              <span className="w-3 shrink-0 flex items-center justify-center">
                {!value && <Check size={9} className="text-zk-green" />}
              </span>
              <span className="font-sans text-xs text-zk-muted/50 italic">{clearLabel}</span>
            </button>

            {/* Permission rows */}
            {filtered.length === 0 && (
              <p className="font-sans text-xs text-zk-muted/30 px-4 py-3 text-center">No matches</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p.name)}
                className={cn(
                  "w-full flex items-start gap-2 px-2.5 py-2 text-left transition-colors",
                  "border-b border-zk-border/10 last:border-0",
                  value === p.name ? "bg-zk-green/8" : "hover:bg-zk-green/5",
                )}
              >
                <span className="w-3 mt-0.5 shrink-0 flex items-center justify-center">
                  {value === p.name && <Check size={9} className="text-zk-green" />}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className={cn(
                    "font-mono text-xs leading-tight truncate",
                    value === p.name ? "text-zk-green" : "text-zk-white",
                  )}>
                    {p.name}
                  </span>
                  {p.description && (
                    <span className="font-sans text-xs text-zk-muted/40 leading-tight truncate mt-0.5">
                      {p.description}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared channel form (create & edit) ─────────────────────
function ChannelForm({
  title,
  initial,
  permOptions,
  loadingPerms,
  submitting,
  error,
  onSubmit,
  onClose,
}: {
  title:        string;
  initial:      ChannelFormState;
  permOptions:  PermissionOption[];
  loadingPerms: boolean;
  submitting:   boolean;
  error:        string;
  onSubmit:     (f: ChannelFormState) => void;
  onClose:      () => void;
}) {
  const [form, setForm] = useState<ChannelFormState>(initial);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => labelRef.current?.focus(), 50); }, []);
  // Sync if parent changes initial (e.g. switching which channel to edit)
  useEffect(() => { setForm(initial); }, [initial.label, initial.topic, initial.isPublic, initial.viewPermission, initial.deletePermission]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof ChannelFormState, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="mx-2 mb-2 rounded border border-zk-border/60 bg-zk-surface/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-zk-border/40">
        <Hash size={10} className="text-zk-muted/50 shrink-0" />
        <span className="font-sans text-xs text-zk-muted/50 flex-1">{title}</span>
        <button onClick={onClose} className="text-zk-muted/40 hover:text-zk-white shrink-0">
          <X size={10} />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-2.5">
        {/* Label */}
        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs text-zk-muted/40">Display name *</label>
          <input
            ref={labelRef}
            type="text"
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="e.g. General Ops"
            maxLength={64}
            className="w-full bg-zk-bg/60 border border-zk-border/40 rounded px-2 py-1 font-sans text-xs text-zk-white placeholder:text-zk-muted/30 outline-none focus:border-zk-green/40"
          />
        </div>

        {/* Topic */}
        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs text-zk-muted/40">Topic <span className="text-zk-muted/25">(optional)</span></label>
          <input
            type="text"
            value={form.topic}
            onChange={(e) => set("topic", e.target.value)}
            placeholder="Short description"
            maxLength={256}
            className="w-full bg-zk-bg/60 border border-zk-border/40 rounded px-2 py-1 font-sans text-xs text-zk-white placeholder:text-zk-muted/30 outline-none focus:border-zk-green/40"
          />
        </div>

        {/* Who can view */}
        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-xs text-zk-muted/40">Who can view</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => set("isPublic", true)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1 rounded font-sans text-xs transition-all border",
                form.isPublic
                  ? "bg-zk-green/15 text-zk-green border-zk-green/30"
                  : "text-zk-muted/40 border-zk-border/40 hover:border-zk-border/70"
              )}
            >
              <Globe size={9} /> Everyone
            </button>
            <button
              onClick={() => set("isPublic", false)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1 rounded font-sans text-xs transition-all border",
                !form.isPublic
                  ? "bg-zk-green/15 text-zk-green border-zk-green/30"
                  : "text-zk-muted/40 border-zk-border/40 hover:border-zk-border/70"
              )}
            >
              <ShieldCheck size={9} /> Restricted
            </button>
          </div>

          {!form.isPublic && (
            <PermPicker
              value={form.viewPermission}
              onChange={(v) => set("viewPermission", v)}
              options={permOptions}
              loading={loadingPerms}
              placeholder="Select required permission"
              clearLabel="— select a permission —"
            />
          )}
        </div>

        {/* Who can delete messages */}
        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs text-zk-muted/40">
            Delete messages permission <span className="text-zk-muted/25">(optional)</span>
          </label>
          <PermPicker
            value={form.deletePermission}
            onChange={(v) => set("deletePermission", v)}
            options={permOptions}
            loading={loadingPerms}
            placeholder="No restriction"
            clearLabel="— no restriction —"
          />
        </div>

        {error && <p className="font-sans text-xs text-zk-red/70">{error}</p>}

        <button
          onClick={() => onSubmit(form)}
          disabled={submitting || !form.label.trim() || (!form.isPublic && !form.viewPermission)}
          className={cn(
            "w-full py-1 rounded font-sans text-xs transition-all",
            submitting || !form.label.trim() || (!form.isPublic && !form.viewPermission)
              ? "bg-zk-green/10 text-zk-green/30 cursor-not-allowed"
              : "bg-zk-green/15 text-zk-green hover:bg-zk-green/25"
          )}
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function ChatSidebar({
  channels, activeChannel, onSelect, dmConvos, activeDmUser, onRefreshDms,
  loadingChannels, loadingDms, presence = {}, isAdmin = false,
  onCreateChannel, onEditChannel, onDeleteChannel,
}: ChatSidebarProps) {
  // DM search
  const [searching,     setSearching]     = useState(false);
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Channel management
  const [showCreate,      setShowCreate]      = useState(false);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  // Shared form state
  const [submitting,    setSubmitting]    = useState(false);
  const [formError,     setFormError]     = useState("");
  const [permOptions,   setPermOptions]   = useState<PermissionOption[]>([]);
  const [loadingPerms,  setLoadingPerms]  = useState(false);

  // Fetch permissions list when create or edit form opens
  useEffect(() => {
    if (!showCreate && !editingId) return;
    if (permOptions.length > 0) return; // already loaded
    setLoadingPerms(true);
    fetch("/api/admin/permissions")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setPermOptions(d); })
      .catch(() => {})
      .finally(() => setLoadingPerms(false));
  }, [showCreate, editingId, permOptions.length]);

  useEffect(() => {
    if (searching) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searching]);

  useEffect(() => {
    if (!searching || query.length < 1) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res  = await fetch(`/api/chat/users-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (Array.isArray(data)) setResults(data);
      } catch { /* silent */ }
      finally { setLoadingSearch(false); }
    }, 300);
  }, [query, searching]);

  async function handleCreate(form: ChannelFormState) {
    if (!onCreateChannel) return;
    setFormError("");
    setSubmitting(true);
    try {
      await onCreateChannel(
        form.label.trim(),
        form.topic.trim(),
        form.isPublic,
        form.isPublic ? null : (form.viewPermission || null),
        form.deletePermission || null,
      );
      setShowCreate(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to create channel");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(form: ChannelFormState) {
    if (!onEditChannel || !editingId) return;
    setFormError("");
    setSubmitting(true);
    try {
      await onEditChannel(
        editingId,
        form.label.trim(),
        form.topic.trim(),
        form.isPublic,
        form.isPublic ? null : (form.viewPermission || null),
        form.deletePermission || null,
      );
      setEditingId(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to update channel");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmAndDelete(channelId: string) {
    if (!onDeleteChannel || deletingId) return;
    setConfirmDeleteId(null);
    setDeletingId(channelId);
    try {
      await onDeleteChannel(channelId);
    } finally {
      setDeletingId(null);
    }
  }

  function openDM(user: SearchResult) {
    setSearching(false);
    setQuery("");
    setResults([]);
    onSelect(`dm:${user.id}`, "dm", user.id, user.username);
  }

  function closeSearch() {
    setSearching(false);
    setQuery("");
    setResults([]);
  }

  function openCreate() {
    setEditingId(null);
    setFormError("");
    setShowCreate((v) => !v);
  }

  function openEdit(ch: Channel) {
    setShowCreate(false);
    setFormError("");
    setEditingId((prev) => (prev === ch.id ? null : ch.id));
  }

  return (
    <aside className={cn(
      "w-56 shrink-0 flex flex-col overflow-hidden",
      "border-r border-zk-border bg-[rgba(13,17,23,0.6)]",
    )}>

      {/* Wordmark */}
      <div className="px-4 py-3 border-b border-zk-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zk-green shadow-glow-sm animate-pulse shrink-0" />
          <span className="font-sans text-xs text-zk-muted/60">Comms</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* ── Channels ──────────────────────────────────── */}
        <SectionLabel
          action={isAdmin ? (
            <button
              onClick={openCreate}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded font-sans text-xs transition-all border",
                showCreate
                  ? "text-zk-green bg-zk-green/10 border-zk-green/20"
                  : "text-zk-muted/40 hover:text-zk-green border-transparent hover:border-zk-border/50"
              )}
              aria-label="New channel"
            >
              <Plus size={9} /><span>New</span>
            </button>
          ) : undefined}
        >
          Channels
        </SectionLabel>

        {/* Create form */}
        {showCreate && isAdmin && (
          <ChannelForm
            title="New channel"
            initial={EMPTY_FORM}
            permOptions={permOptions}
            loadingPerms={loadingPerms}
            submitting={submitting}
            error={formError}
            onSubmit={handleCreate}
            onClose={() => { setShowCreate(false); setFormError(""); }}
          />
        )}

        {loadingChannels ? <SkeletonChannels /> : (
          <div className="px-2 flex flex-col gap-px">
            {channels.map((ch) => {
              const active    = activeChannel === ch.id && !activeDmUser;
              const canView   = ch.permissions.includes(`view:${ch.id}`) || isAdmin;
              const isEditing = editingId === ch.id;

              // Build edit initial state from channel data
              const editInitial: ChannelFormState = {
                label:            ch.label.replace("#", ""),
                topic:            ch.topic,
                isPublic:         ch.isPublic,
                viewPermission:   ch.viewPermission ?? "",
                deletePermission: ch.deletePermission ?? "",
              };

              return (
                <div key={ch.id} className="flex flex-col">
                  <button
                    onClick={() => canView && onSelect(ch.id, "channel")}
                    disabled={!canView}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded text-left",
                      "transition-all duration-150 group",
                      active
                        ? "border-l-2 border-l-zk-green bg-zk-green/[0.06]"
                        : canView
                          ? "border-l-2 border-l-transparent hover:bg-zk-green/[0.03] hover:border-l-zk-green/30"
                          : "border-l-2 border-l-transparent opacity-35 cursor-not-allowed",
                    )}
                  >
                    {/* Icon */}
                    <span className={cn("shrink-0 transition-colors", active ? "text-zk-green" : canView ? "text-zk-muted/50" : "text-zk-muted/30")}>
                      {canView ? <Hash size={12} /> : <Lock size={11} />}
                    </span>

                    {/* Label */}
                    <span className={cn("font-sans text-sm truncate flex-1", active ? "text-zk-green" : "text-zk-slate")}>
                      {ch.label.replace("#", "")}
                    </span>

                    {/* Unread badge */}
                    {ch.unread > 0 && !active && canView && (
                      <span className="shrink-0 font-sans text-xs leading-none bg-zk-green text-zk-bg px-1.5 py-0.5 rounded">
                        {ch.unread}
                      </span>
                    )}

                    {/* Members */}
                    {active && ch.memberCount > 0 && (
                      <span className="shrink-0 font-sans text-xs text-zk-green/50">{ch.memberCount}</span>
                    )}

                    {/* Admin actions */}
                    {isAdmin && (
                      <span className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span
                          role="button"
                          aria-label={`Edit ${ch.label}`}
                          onClick={(e) => { e.stopPropagation(); openEdit(ch); }}
                          className={cn(
                            "text-zk-muted/40 hover:text-zk-green/70 transition-colors",
                            isEditing && "text-zk-green/70",
                          )}
                        >
                          <Pencil size={10} />
                        </span>
                        <span
                          role="button"
                          aria-label={`Delete ${ch.label}`}
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(ch.id); }}
                          className={cn(
                            "text-zk-muted/40 hover:text-zk-red/70 transition-colors",
                            (deletingId === ch.id || confirmDeleteId === ch.id) && "text-zk-red/70 opacity-100",
                          )}
                        >
                          <Trash2 size={10} />
                        </span>
                      </span>
                    )}
                  </button>

                  {/* Inline edit form */}
                  {isEditing && isAdmin && (
                    <ChannelForm
                      title={`Edit #${ch.label.replace("#", "")}`}
                      initial={editInitial}
                      permOptions={permOptions}
                      loadingPerms={loadingPerms}
                      submitting={submitting}
                      error={formError}
                      onSubmit={handleEdit}
                      onClose={() => { setEditingId(null); setFormError(""); }}
                    />
                  )}

                  {/* Inline delete confirmation */}
                  {confirmDeleteId === ch.id && (
                    <div className="mx-2 mb-1 rounded border border-zk-red/20 bg-zk-red/5 px-2.5 py-2 flex flex-col gap-2">
                      <p className="font-sans text-xs text-zk-red/80 leading-snug">
                        Delete <span className="font-semibold">#{ch.label.replace("#", "")}</span> and all its messages?
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => confirmAndDelete(ch.id)}
                          disabled={!!deletingId}
                          className={cn(
                            "flex-1 py-0.5 rounded font-sans text-xs transition-all",
                            deletingId === ch.id
                              ? "bg-zk-red/10 text-zk-red/30 cursor-not-allowed animate-pulse"
                              : "bg-zk-red/20 text-zk-red/80 hover:bg-zk-red/30"
                          )}
                        >
                          {deletingId === ch.id ? "Deleting..." : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={!!deletingId}
                          className="flex-1 py-0.5 rounded font-sans text-xs text-zk-muted/50 hover:text-zk-white border border-zk-border/40 hover:border-zk-border/70 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Direct Messages ───────────────────────────── */}
        <SectionLabel
          action={
            <button
              onClick={() => setSearching((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded font-sans text-xs transition-all border",
                searching
                  ? "text-zk-green bg-zk-green/10 border-zk-green/20"
                  : "text-zk-muted/40 hover:text-zk-green border-transparent hover:border-zk-border/50"
              )}
              aria-label="New direct message"
            >
              <Plus size={9} /><span>New</span>
            </button>
          }
        >
          Direct
        </SectionLabel>

        {/* DM search panel */}
        {searching && (
          <div className="mx-2 mb-2 rounded border border-zk-border/60 bg-zk-surface/60 overflow-hidden">
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-zk-border/40">
              <Search size={10} className="text-zk-muted/50 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="username, name or email..."
                className="flex-1 bg-transparent outline-none font-sans text-sm text-zk-white placeholder:text-zk-muted/30 caret-zk-green"
              />
              <button onClick={closeSearch} className="text-zk-muted/40 hover:text-zk-white shrink-0">
                <X size={10} />
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {loadingSearch && (
                <p className="font-sans text-xs text-zk-muted/40 px-3 py-2 animate-pulse">Searching...</p>
              )}
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openDM(u)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zk-green/8 transition-colors text-left border-b border-zk-border/20 last:border-0"
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[u.status] ?? STATUS_DOT.OFFLINE)} />
                  <div className="min-w-0">
                    <p className="font-sans text-sm text-zk-white truncate leading-tight">{u.name}</p>
                    <p className="font-sans text-xs text-zk-muted/50 truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
              {query.length > 0 && !loadingSearch && results.length === 0 && (
                <p className="font-sans text-xs text-zk-muted/30 px-3 py-2">No users found</p>
              )}
            </div>
          </div>
        )}

        {/* DM list */}
        {loadingDms ? <SkeletonDms /> : (
          <div className="px-2 flex flex-col gap-px">
            {dmConvos.length === 0 && !searching && (
              <p className="font-sans text-xs text-zk-muted/25 px-2.5 py-1.5 italic">No conversations yet</p>
            )}
            {dmConvos.map((dm) => {
              const active = activeDmUser === dm.userId;
              return (
                <button
                  key={dm.userId}
                  onClick={() => onSelect(`dm:${dm.userId}`, "dm", dm.userId)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded transition-all duration-150",
                    active
                      ? "border-l-2 border-l-zk-green bg-zk-green/[0.06]"
                      : "border-l-2 border-l-transparent hover:bg-zk-green/[0.03] hover:border-l-zk-green/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300",
                        presence[dm.userId] === "ONLINE"
                          ? active ? "bg-zk-green shadow-glow-sm" : "bg-zk-green"
                          : "bg-zk-muted/30",
                      )} />
                      <span className={cn(
                        "font-sans text-sm truncate",
                        active ? "text-zk-green" : dm.unread > 0 ? "text-zk-white font-semibold" : "text-zk-slate"
                      )}>
                        {dm.handle}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {dm.unread > 0 && !active && (
                        <span className="font-sans text-xs leading-none bg-zk-green text-zk-bg px-1.5 py-0.5 rounded">
                          {dm.unread}
                        </span>
                      )}
                      {dm.lastTime && (
                        <span className="font-sans text-xs text-zk-muted/30">{relativeTime(dm.lastTime)}</span>
                      )}
                    </div>
                  </div>
                  {dm.lastMsg && (
                    <p className={cn("font-sans text-sm truncate pl-3.5", active ? "text-zk-green/50" : "text-zk-muted/40")}>
                      {dm.lastMsg}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zk-border/40">
        <span className="font-sans text-xs text-zk-muted/20">AES-256 encrypted</span>
      </div>
    </aside>
  );
}
