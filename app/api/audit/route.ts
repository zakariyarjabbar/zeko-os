// app/api/audit/route.ts
// GET /api/audit?limit=50&cursor=<opaque>&action=<action>&targetType=<type>
// Administrator-only security audit event listing.

import { NextRequest, NextResponse } from "next/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { isFounder } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, badRequest, forbidden, internalError, requireSession } from "@/lib/api";
import type { AuditEvent, AuditEventsResponse } from "@/lib/types/audit";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const EXPORT_MAX_LIMIT = 1000;
const SEVERITIES = new Set(["info", "low", "medium", "high", "critical"]);

function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), "utf8").toString("base64url");
}

function decodeCursor(raw: string): string | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { id?: unknown };
    return typeof parsed.id === "string" || typeof parsed.id === "number"
      ? String(parsed.id)
      : null;
  } catch {
    return null;
  }
}

function parseLimit(raw: string | null, max = MAX_LIMIT): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), max);
}

interface ResolvedUser {
  id: string;
  label: string;
  username: string | null;
  displayName: string | null;
  displayId: number | null;
}

async function resolveUsers(userIds: string[]): Promise<Map<string, ResolvedUser>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_id, display_name, username")
    .in("id", unique);

  if (error) {
    console.error("[audit/list] profile resolve error:", error.message);
    return new Map();
  }

  const map = new Map<string, ResolvedUser>();
  for (const row of data ?? []) {
    const profile = row as {
      id: string;
      display_id: number | null;
      display_name: string | null;
      username: string | null;
    };
    const displayName = profile.display_name?.trim() || null;
    const username = profile.username?.trim() || null;
    const label = displayName || (username ? `@${username}` : profile.id);
    map.set(profile.id, {
      id: profile.id,
      label,
      username,
      displayName,
      displayId: profile.display_id ?? null,
    });
  }
  return map;
}

async function resolveNamedTargets(
  table: "roles" | "permissions",
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id, name")
    .in("id", unique);

  if (error) {
    console.error(`[audit/list] ${table} resolve error:`, error.message);
    return new Map();
  }

  return new Map((data ?? []).map((row) => {
    const item = row as { id: string; name: string | null };
    return [item.id, item.name || item.id];
  }));
}

async function resolveChannelTargets(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from("channels")
    .select("id, label")
    .in("id", unique);

  if (error) {
    console.error("[audit/list] channel resolve error:", error.message);
    return new Map();
  }

  return new Map((data ?? []).map((row) => {
    const item = row as { id: string; label: string | null };
    return [item.id, item.label || item.id];
  }));
}

function fallbackTargetLabel(row: Record<string, unknown>): string {
  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata as Record<string, unknown>
    : {};
  if (typeof metadata.name === "string" && metadata.name.trim()) return metadata.name.trim();
  if (typeof metadata.label === "string" && metadata.label.trim()) return metadata.label.trim();
  if (typeof metadata.subject === "string" && metadata.subject.trim()) return metadata.subject.trim();
  if (typeof metadata.email === "string" && metadata.email.trim()) return metadata.email.trim();
  if (typeof metadata.username === "string" && metadata.username.trim()) return `@${metadata.username.trim()}`;
  return typeof row.target_id === "string" ? row.target_id : "none";
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function diffObject(value: unknown): AuditEvent["diff"] {
  const raw = jsonObject(value);
  const result: AuditEvent["diff"] = {};
  for (const [key, item] of Object.entries(raw)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    result[key] = {
      before: entry.before,
      after: entry.after,
    };
  }
  return result;
}

function toEvent(
  row: Record<string, unknown>,
  resolved: {
    users: Map<string, ResolvedUser>;
    roles: Map<string, string>;
    permissions: Map<string, string>;
    channels: Map<string, string>;
  },
): AuditEvent {
  const actorUserId = typeof row.actor_user_id === "string" ? row.actor_user_id : null;
  const targetType = String(row.target_type);
  const targetId = typeof row.target_id === "string" ? row.target_id : null;
  const actorUser = actorUserId ? resolved.users.get(actorUserId) ?? null : null;
  const targetUser = targetType === "user" && targetId ? resolved.users.get(targetId) ?? null : null;
  const namedTarget =
    targetType === "role" && targetId ? resolved.roles.get(targetId) :
    targetType === "permission" && targetId ? resolved.permissions.get(targetId) :
    targetType === "channel" && targetId ? resolved.channels.get(targetId) :
    null;

  return {
    id: String(row.id),
    occurredAt: String(row.occurred_at),
    action: String(row.action),
    severity: SEVERITIES.has(String(row.severity)) ? String(row.severity) as AuditEvent["severity"] : "info",
    actorUserId,
    actorSessionId: typeof row.actor_session_id === "string" ? row.actor_session_id : null,
    actor: actorUser,
    targetType,
    targetId,
    target: targetUser
      ? {
          type: targetType,
          id: targetId,
          label: targetUser.label,
          username: targetUser.username,
          displayName: targetUser.displayName,
          displayId: targetUser.displayId,
        }
      : {
          type: targetType,
          id: targetId,
          label: namedTarget ?? fallbackTargetLabel(row),
        },
    actorSnapshot: jsonObject(row.actor_snapshot),
    targetSnapshot: jsonObject(row.target_snapshot),
    diff: diffObject(row.diff),
    metadata: jsonObject(row.metadata),
    ip: typeof row.ip === "string" ? row.ip : null,
    userAgent: typeof row.user_agent === "string" ? row.user_agent : null,
    requestId: typeof row.request_id === "string" ? row.request_id : null,
    previousHash: typeof row.previous_hash === "string" ? row.previous_hash : null,
    eventHash: typeof row.event_hash === "string" ? row.event_hash : null,
  };
}

function csvCell(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function eventsToCsv(events: AuditEvent[]): string {
  const headers = [
    "id",
    "occurredAt",
    "severity",
    "action",
    "actor",
    "actorUserId",
    "targetType",
    "target",
    "targetId",
    "ip",
    "requestId",
    "previousHash",
    "eventHash",
    "metadata",
    "diff",
  ];
  const rows = events.map((event) => [
    event.id,
    event.occurredAt,
    event.severity,
    event.action,
    event.actor?.label ?? event.actorUserId ?? "",
    event.actorUserId ?? "",
    event.targetType,
    event.target.label,
    event.targetId ?? "",
    event.ip ?? "",
    event.requestId ?? "",
    event.previousHash ?? "",
    event.eventHash ?? "",
    event.metadata,
    event.diff,
  ].map(csvCell).join(","));
  return [headers.join(","), ...rows].join("\n");
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids)) {
    return forbidden("Forbidden. Administrator permission required.", req);
  }

  const format = req.nextUrl.searchParams.get("format");
  const isExport = format === "csv" || format === "json";
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"), isExport ? EXPORT_MAX_LIMIT : MAX_LIMIT);
  const cursor = req.nextUrl.searchParams.get("cursor");
  const action = req.nextUrl.searchParams.get("action");
  const targetType = req.nextUrl.searchParams.get("targetType");
  const severity = req.nextUrl.searchParams.get("severity");
  const actorId = req.nextUrl.searchParams.get("actorId");
  const targetId = req.nextUrl.searchParams.get("targetId");

  if (format && !isExport) return badRequest("Invalid export format.", req);
  if (severity && severity !== "all" && !SEVERITIES.has(severity)) return badRequest("Invalid severity.", req);

  let beforeId: string | null = null;
  if (cursor) {
    beforeId = decodeCursor(cursor);
    if (!beforeId) return badRequest("Invalid cursor.", req);
  }

  let query = supabaseAdmin
    .from("security_audit_events")
    .select("id, actor_user_id, actor_session_id, action, severity, target_type, target_id, metadata, actor_snapshot, target_snapshot, diff, ip, user_agent, request_id, previous_hash, event_hash, occurred_at")
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (beforeId && !isExport) query = query.lt("id", beforeId);
  if (action && action !== "all") query = query.eq("action", action);
  if (targetType && targetType !== "all") query = query.eq("target_type", targetType);
  if (severity && severity !== "all") query = query.eq("severity", severity);
  if (actorId) query = query.eq("actor_user_id", actorId);
  if (targetId) query = query.eq("target_id", targetId);

  const { data, error } = await query;
  if (error) {
    console.error("[audit/list] query error:", error.message);
    return internalError(req);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const pageRows = rows.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  const nextCursor = !isExport && rows.length > limit && last ? encodeCursor(String(last.id)) : null;
  const actorIds = pageRows
    .map((row) => row.actor_user_id)
    .filter((id): id is string => typeof id === "string");
  const userTargetIds = pageRows
    .filter((row) => row.target_type === "user")
    .map((row) => row.target_id)
    .filter((id): id is string => typeof id === "string");
  const roleTargetIds = pageRows
    .filter((row) => row.target_type === "role")
    .map((row) => row.target_id)
    .filter((id): id is string => typeof id === "string");
  const permissionTargetIds = pageRows
    .filter((row) => row.target_type === "permission")
    .map((row) => row.target_id)
    .filter((id): id is string => typeof id === "string");
  const channelTargetIds = pageRows
    .filter((row) => row.target_type === "channel")
    .map((row) => row.target_id)
    .filter((id): id is string => typeof id === "string");

  const [users, roles, permissions, channels] = await Promise.all([
    resolveUsers([...actorIds, ...userTargetIds]),
    resolveNamedTargets("roles", roleTargetIds),
    resolveNamedTargets("permissions", permissionTargetIds),
    resolveChannelTargets(channelTargetIds),
  ]);

  const events = pageRows.map((row) => toEvent(row, { users, roles, permissions, channels }));

  if (format === "csv") {
    return new NextResponse(eventsToCsv(events), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="security-audit.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  if (format === "json") {
    return NextResponse.json({ events }, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="security-audit.json"`,
      },
    });
  }

  return apiOk<AuditEventsResponse>({
    events,
    nextCursor,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
