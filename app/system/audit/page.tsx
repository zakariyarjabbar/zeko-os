"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditEvent, AuditEventsResponse } from "@/lib/types/audit";

const ACTION_FILTERS = [
  "all",
  "profile.update",
  "profile.password_change",
  "user.create",
  "user.update",
  "user.delete",
  "role.create",
  "role.update",
  "role.delete",
  "permission.create",
  "permission.update",
  "permission.delete",
  "session.revoke",
  "session.revoke_others",
  "channel.create",
  "channel.update",
  "channel.delete",
  "message.delete",
  "inbox.read",
  "inbox.delete",
  "inbox.reply",
] as const;

const TARGET_FILTERS = ["all", "user", "role", "permission", "session", "channel", "message", "inbox_message"] as const;
const SEVERITY_FILTERS = ["all", "info", "low", "medium", "high", "critical"] as const;

function timeStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actionTone(action: string): string {
  if (action.endsWith(".delete") || action.includes("revoke")) {
    return "border-zk-red/35 bg-zk-red/8 text-zk-red";
  }
  if (action.endsWith(".create")) {
    return "border-zk-green/35 bg-zk-green/8 text-zk-green";
  }
  return "border-zk-cyan/30 bg-zk-cyan/8 text-zk-cyan";
}

function severityTone(severity: AuditEvent["severity"]): string {
  if (severity === "critical") return "border-zk-red bg-zk-red/15 text-zk-red";
  if (severity === "high") return "border-zk-red/45 bg-zk-red/10 text-zk-red";
  if (severity === "medium") return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  if (severity === "low") return "border-zk-cyan/30 bg-zk-cyan/8 text-zk-cyan";
  return "border-zk-border/60 bg-zk-surface/30 text-zk-muted";
}

function metadataPreview(metadata: Record<string, unknown>): string {
  const keys = Object.keys(metadata);
  if (keys.length === 0) return "no metadata";
  return keys.slice(0, 3).map((key) => `${key}:${String(metadata[key])}`).join("  ");
}

function actorLabel(event: AuditEvent): string {
  return event.actor?.label ?? event.actorUserId ?? "unknown actor";
}

function targetLabel(event: AuditEvent): string {
  const label = event.target.label || event.targetId || "none";
  return `${event.targetType}:${label}`;
}

function snapshotLabel(snapshot: AuditEvent["actorSnapshot"] | AuditEvent["targetSnapshot"]): string {
  return snapshot.label ?? snapshot.displayName ?? snapshot.name ?? snapshot.username ?? snapshot.id ?? "not captured";
}

function hasDiff(event: AuditEvent): boolean {
  return Object.keys(event.diff).length > 0;
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function readApiError(res: Response): Promise<string> {
  try {
    const data = await res.json() as { error?: string };
    return data.error ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [action, setAction] = useState<(typeof ACTION_FILTERS)[number]>("all");
  const [targetType, setTargetType] = useState<(typeof TARGET_FILTERS)[number]>("all");
  const [severity, setSeverity] = useState<(typeof SEVERITY_FILTERS)[number]>("all");
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "replace" | "append" = "replace") => {
    if (mode === "append") setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: "50" });
      if (action !== "all") params.set("action", action);
      if (targetType !== "all") params.set("targetType", targetType);
      if (severity !== "all") params.set("severity", severity);
      if (actorId.trim()) params.set("actorId", actorId.trim());
      if (targetId.trim()) params.set("targetId", targetId.trim());
      if (mode === "append" && nextCursor) params.set("cursor", nextCursor);

      const res = await fetch(`/api/audit?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const data = await res.json() as AuditEventsResponse;
      setEvents((prev) => mode === "append" ? [...prev, ...data.events] : data.events);
      setNextCursor(data.nextCursor);
      setSelectedId((current) => {
        if (mode === "append" && current) return current;
        return data.events[0]?.id ?? null;
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [action, targetType, severity, actorId, targetId, nextCursor]);

  useEffect(() => {
    void load("replace");
  }, [action, targetType, severity]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportEvents = useCallback(async (format: "csv" | "json") => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "1000", format });
      if (action !== "all") params.set("action", action);
      if (targetType !== "all") params.set("targetType", targetType);
      if (severity !== "all") params.set("severity", severity);
      if (actorId.trim()) params.set("actorId", actorId.trim());
      if (targetId.trim()) params.set("targetId", targetId.trim());

      const res = await fetch(`/api/audit?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-audit.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Please try again.");
    }
  }, [action, targetType, severity, actorId, targetId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) => {
      const hay = [
        event.action,
        event.severity,
        event.targetType,
        event.targetId,
        event.actorUserId,
        event.actor?.label,
        event.actor?.username,
        event.target.label,
        event.target.username,
        snapshotLabel(event.actorSnapshot),
        snapshotLabel(event.targetSnapshot),
        prettyJson(event.diff),
        event.ip,
        prettyJson(event.metadata),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [events, query]);

  const selected = filtered.find((event) => event.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 flex items-center gap-3 px-5 h-10 border-b border-zk-border/40 bg-zk-surface/10">
        <ShieldAlert size={13} className="text-zk-green" />
        <span className="font-sans text-sm font-semibold text-zk-white">Security Audit</span>
        <span className="font-mono text-[10px] text-zk-muted/40">{events.length} loaded</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportEvents("csv")}
            className={cn(
              "h-7 px-3 rounded-sm border font-sans text-xs flex items-center gap-2",
              "border-zk-border bg-zk-surface/25 text-zk-slate hover:text-zk-green hover:border-zk-green/35 transition-colors",
            )}
          >
            <Download size={12} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => exportEvents("json")}
            className={cn(
              "h-7 px-3 rounded-sm border font-sans text-xs flex items-center gap-2",
              "border-zk-border bg-zk-surface/25 text-zk-slate hover:text-zk-green hover:border-zk-green/35 transition-colors",
            )}
          >
            <Download size={12} />
            JSON
          </button>
          <button
            type="button"
            onClick={() => load("replace")}
            disabled={loading}
            className={cn(
              "h-7 px-3 rounded-sm border font-sans text-xs flex items-center gap-2",
              "border-zk-green/30 bg-zk-green/6 text-zk-green hover:bg-zk-green/12",
              "disabled:opacity-45 disabled:pointer-events-none transition-colors",
            )}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="shrink-0 px-4 py-3 border-b border-zk-border/30 bg-zk-bg space-y-2">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zk-muted/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search events"
              className="w-full h-8 pl-8 pr-3 rounded-sm border border-zk-border bg-zk-surface/40 font-sans text-sm text-zk-white placeholder:text-zk-muted/30 outline-none focus:border-zk-green/45"
            />
          </div>

          <Filter size={12} className="text-zk-muted/35" />
          <ChipGroup values={ACTION_FILTERS} value={action} onChange={setAction} />
        </div>
        <div className="flex items-center gap-3">
          <ChipGroup values={SEVERITY_FILTERS} value={severity} onChange={setSeverity} compact />
          <ChipGroup values={TARGET_FILTERS} value={targetType} onChange={setTargetType} compact />
          <input
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            onBlur={() => load("replace")}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load("replace");
            }}
            placeholder="actor user id"
            className="h-7 w-48 px-2 rounded-sm border border-zk-border bg-zk-surface/35 font-mono text-[10px] text-zk-white placeholder:text-zk-muted/30 outline-none focus:border-zk-green/45"
          />
          <input
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            onBlur={() => load("replace")}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load("replace");
            }}
            placeholder="target id"
            className="h-7 w-48 px-2 rounded-sm border border-zk-border bg-zk-surface/35 font-mono text-[10px] text-zk-white placeholder:text-zk-muted/30 outline-none focus:border-zk-green/45"
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-[24rem] shrink-0 flex flex-col border-r border-zk-border/50 bg-zk-surface/15">
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-4 py-4 font-sans text-sm text-zk-muted/50">Loading audit events...</div>
            )}
            {!loading && error && (
              <div className="m-4 flex items-start gap-2 px-3 py-2 rounded-sm border border-zk-red/30 bg-zk-red/5 text-zk-red font-sans text-sm">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Database size={22} className="mx-auto text-zk-muted/25" />
                <p className="mt-3 font-sans text-sm text-zk-muted/45">No matching audit events.</p>
              </div>
            )}
            {!loading && !error && filtered.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedId(event.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-zk-border/15 transition-colors",
                  selected?.id === event.id
                    ? "bg-zk-green/[0.06] border-l-2 border-l-zk-green pl-[14px]"
                    : "hover:bg-zk-green/[0.025]",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("px-1.5 py-0.5 rounded-sm border font-mono text-[10px]", severityTone(event.severity))}>
                    {event.severity}
                  </span>
                  <span className={cn("px-1.5 py-0.5 rounded-sm border font-mono text-[10px]", actionTone(event.action))}>
                    {event.action}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-zk-muted/45">
                    #{event.id}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-zk-muted/55 truncate">
                  actor: <span className="text-zk-slate">{actorLabel(event)}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-zk-muted/55 truncate">
                  target: <span className="text-zk-slate">{targetLabel(event)}</span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-zk-muted/35 truncate">
                  {timeStamp(event.occurredAt)}  {metadataPreview(event.metadata)}
                </div>
              </button>
            ))}
          </div>

          {nextCursor && !query.trim() && (
            <div className="shrink-0 p-3 border-t border-zk-border/30 bg-zk-bg">
              <button
                type="button"
                onClick={() => load("append")}
                disabled={loadingMore}
                className="w-full h-8 rounded-sm border border-zk-border bg-zk-surface/30 text-zk-slate hover:text-zk-green hover:border-zk-green/35 font-sans text-xs transition-colors disabled:opacity-45"
              >
                {loadingMore ? "Loading..." : "Load older events"}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto bg-zk-bg">
          {selected ? <AuditDetail event={selected} /> : <EmptyDetail />}
        </div>
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  values,
  value,
  onChange,
  compact = false,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1 overflow-hidden", compact ? "max-w-none" : "flex-1")}>
      {values.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "h-7 px-2 rounded-sm border font-mono text-[10px] whitespace-nowrap transition-colors",
            value === item
              ? "border-zk-green/45 bg-zk-green/10 text-zk-green"
              : "border-zk-border/50 bg-zk-surface/25 text-zk-muted/45 hover:text-zk-slate",
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function AuditDetail({ event }: { event: AuditEvent }) {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-sm border border-zk-green/25 bg-zk-green/8 flex items-center justify-center text-zk-green">
          <Terminal size={17} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-1 rounded-sm border font-mono text-xs", actionTone(event.action))}>
              {event.action}
            </span>
            <span className={cn("px-2 py-1 rounded-sm border font-mono text-xs", severityTone(event.severity))}>
              {event.severity}
            </span>
            <span className="font-mono text-xs text-zk-muted/45">event #{event.id}</span>
          </div>
          <p className="mt-2 font-sans text-sm text-zk-muted/60">{timeStamp(event.occurredAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DetailCard
          label="Actor"
          value={actorLabel(event)}
          sub={[
            snapshotLabel(event.actorSnapshot) !== actorLabel(event)
              ? `at event: ${snapshotLabel(event.actorSnapshot)}`
              : null,
            event.actor?.username ? `@${event.actor.username}` : null,
            event.actor?.displayId ? `#${event.actor.displayId}` : null,
            event.actorUserId ? `id ${event.actorUserId}` : null,
            event.actorSessionId ? `session ${event.actorSessionId}` : null,
          ].filter(Boolean).join("  ")}
        />
        <DetailCard
          label="Target"
          value={targetLabel(event)}
          sub={[
            snapshotLabel(event.targetSnapshot) !== event.target.label
              ? `at event: ${snapshotLabel(event.targetSnapshot)}`
              : null,
            event.target.username ? `@${event.target.username}` : null,
            event.target.displayId ? `#${event.target.displayId}` : null,
            event.targetId ? `id ${event.targetId}` : "no target id",
          ].filter(Boolean).join("  ")}
        />
        <DetailCard label="Network" value={event.ip ?? "unknown"} sub={event.userAgent ?? "no user agent"} />
        <DetailCard label="Request" value={event.requestId ?? "not captured"} sub="correlates server logs and audit row" />
        <DetailCard label="Hash" value={event.eventHash ?? "not captured"} sub={event.previousHash ? `previous ${event.previousHash}` : "start of chain or not captured"} />
      </div>

      <div className="rounded-sm border border-zk-border bg-zk-surface/20 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zk-border/50 bg-black/20">
          <CheckCircle2 size={12} className="text-zk-green" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zk-green/70">Change Diff</span>
        </div>
        {hasDiff(event) ? (
          <div className="divide-y divide-zk-border/35">
            {Object.entries(event.diff).map(([field, change]) => (
              <div key={field} className="grid grid-cols-[9rem_1fr_1fr] gap-3 px-4 py-3">
                <div className="font-mono text-[11px] text-zk-green">{field}</div>
                <DiffValue label="Before" value={change.before} />
                <DiffValue label="After" value={change.after} />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 font-sans text-sm text-zk-muted/45">No field-level diff captured for this event.</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <JsonPanel title="Actor Snapshot" value={event.actorSnapshot} />
        <JsonPanel title="Target Snapshot" value={event.targetSnapshot} />
      </div>

      <div className="rounded-sm border border-zk-border bg-zk-surface/20 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zk-border/50 bg-black/20">
          <CheckCircle2 size={12} className="text-zk-green" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zk-green/70">Metadata</span>
        </div>
        <pre className="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-zk-slate">
          {prettyJson(event.metadata)}
        </pre>
      </div>
    </div>
  );
}

function DiffValue({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9px] uppercase tracking-widest text-zk-muted/35">{label}</div>
      <div className="mt-1 font-mono text-xs text-zk-slate break-all">
        {Array.isArray(value) ? value.join(", ") : String(value ?? "null")}
      </div>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-sm border border-zk-border bg-zk-surface/15 overflow-hidden min-w-0">
      <div className="px-4 py-2 border-b border-zk-border/40 bg-black/15 font-mono text-[10px] uppercase tracking-widest text-zk-muted/55">
        {title}
      </div>
      <pre className="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-zk-slate">
        {prettyJson(value)}
      </pre>
    </div>
  );
}

function DetailCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-sm border border-zk-border bg-zk-surface/15 px-4 py-3 min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-widest text-zk-muted/40">{label}</div>
      <div className="mt-2 font-mono text-xs text-zk-white break-all">{value}</div>
      <div className="mt-1 font-sans text-xs text-zk-muted/45 break-all">{sub}</div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <ShieldAlert size={28} className="mx-auto text-zk-muted/25" />
        <p className="mt-3 font-sans text-sm text-zk-muted/45">Select an audit event.</p>
      </div>
    </div>
  );
}
