// lib/audit.ts
// Server-side append-only audit logging for security-sensitive actions.

import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { SessionPayload } from "@/lib/auth";

export type SecurityAuditAction =
  | "profile.update"
  | "profile.password_change"
  | "user.create"
  | "user.update"
  | "user.delete"
  | "role.create"
  | "role.update"
  | "role.delete"
  | "permission.create"
  | "permission.update"
  | "permission.delete"
  | "session.revoke"
  | "session.revoke_others"
  | "channel.create"
  | "channel.update"
  | "channel.delete"
  | "message.delete"
  | "inbox.read"
  | "inbox.delete"
  | "inbox.reply";

export type SecurityAuditTarget =
  | "user"
  | "role"
  | "permission"
  | "session"
  | "channel"
  | "message"
  | "inbox_message";

export type SecurityAuditSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface SecurityAuditSnapshot {
  id?: string | null;
  label?: string | null;
  username?: string | null;
  displayName?: string | null;
  displayId?: number | null;
  name?: string | null;
  email?: string | null;
  subject?: string | null;
  channelId?: string | null;
  ownerUserId?: string | null;
}

export type SecurityAuditDiff = Record<string, {
  before: unknown;
  after: unknown;
}>;

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

async function resolveUserSnapshot(userId: string): Promise<SecurityAuditSnapshot> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, display_id, display_name, username")
    .eq("id", userId)
    .maybeSingle();

  const profile = data as {
    id: string;
    display_id: number | null;
    display_name: string | null;
    username: string | null;
  } | null;

  if (!profile) return { id: userId, label: userId };

  const displayName = profile.display_name?.trim() || null;
  const username = profile.username?.trim() || null;

  return {
    id: profile.id,
    label: displayName || (username ? `@${username}` : profile.id),
    username,
    displayName,
    displayId: profile.display_id ?? null,
  };
}

async function resolveNamedSnapshot(
  table: "roles" | "permissions",
  id: string,
): Promise<SecurityAuditSnapshot> {
  const { data } = await supabaseAdmin
    .from(table)
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  const row = data as { id: string; name: string | null } | null;
  if (!row) return { id, label: id };
  return { id: row.id, name: row.name, label: row.name || row.id };
}

async function resolveChannelSnapshot(id: string): Promise<SecurityAuditSnapshot> {
  const { data } = await supabaseAdmin
    .from("channels")
    .select("id, label, topic")
    .eq("id", id)
    .maybeSingle();

  const row = data as { id: string; label: string | null; topic: string | null } | null;
  if (!row) return { id, label: id };
  return { id: row.id, label: row.label || row.id, name: row.label, subject: row.topic };
}

async function resolveInboxMessageSnapshot(id: string): Promise<SecurityAuditSnapshot> {
  const { data } = await supabaseAdmin
    .from("contact_messages")
    .select("id, name, email, subject")
    .eq("id", id)
    .maybeSingle();

  const row = data as {
    id: string;
    name: string | null;
    email: string | null;
    subject: string | null;
  } | null;
  if (!row) return { id, label: id };
  return {
    id: row.id,
    label: row.subject || row.email || row.name || row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
  };
}

async function resolveTargetSnapshot(
  targetType: SecurityAuditTarget,
  targetId?: string | null,
): Promise<SecurityAuditSnapshot> {
  if (!targetId) return {};
  if (targetType === "user") return resolveUserSnapshot(targetId);
  if (targetType === "role") return resolveNamedSnapshot("roles", targetId);
  if (targetType === "permission") return resolveNamedSnapshot("permissions", targetId);
  if (targetType === "channel") return resolveChannelSnapshot(targetId);
  if (targetType === "inbox_message") return resolveInboxMessageSnapshot(targetId);
  return { id: targetId, label: targetId };
}

function defaultSeverity(action: SecurityAuditAction, diff?: SecurityAuditDiff): SecurityAuditSeverity {
  if (action === "user.delete" || action === "profile.password_change") return "high";
  if (action === "permission.update" || action === "permission.delete") return "high";
  if (action === "user.update") {
    const changed = new Set(Object.keys(diff ?? {}));
    if (changed.has("password") || changed.has("accessFlags") || changed.has("roleIds")) return "high";
    return "medium";
  }
  if (
    action.startsWith("role.") ||
    action.startsWith("session.") ||
    action === "channel.delete" ||
    action === "message.delete" ||
    action === "inbox.delete" ||
    action === "inbox.reply"
  ) {
    return "medium";
  }
  if (action.endsWith(".create") || action.endsWith(".update") || action === "inbox.read") return "low";
  return "info";
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalize((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}

async function latestAuditHash(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("security_audit_events")
    .select("event_hash")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as { event_hash: string | null } | null;
  return row?.event_hash ?? null;
}

export async function logSecurityAuditEvent(args: {
  req: NextRequest;
  actor: SessionPayload;
  action: SecurityAuditAction;
  targetType: SecurityAuditTarget;
  targetId?: string | null;
  severity?: SecurityAuditSeverity;
  metadata?: Record<string, unknown>;
  actorSnapshot?: SecurityAuditSnapshot;
  targetSnapshot?: SecurityAuditSnapshot;
  diff?: SecurityAuditDiff;
}): Promise<void> {
  try {
    const [actorSnapshot, targetSnapshot] = await Promise.all([
      args.actorSnapshot ?? resolveUserSnapshot(args.actor.id),
      args.targetSnapshot ?? resolveTargetSnapshot(args.targetType, args.targetId),
    ]);
    const previousHash = await latestAuditHash();
    const severity = args.severity ?? defaultSeverity(args.action, args.diff);
    const payload = {
      actor_user_id:    args.actor.id,
      actor_session_id: args.actor.sid,
      action:           args.action,
      target_type:      args.targetType,
      target_id:        args.targetId ?? null,
      severity,
      metadata:         args.metadata ?? {},
      actor_snapshot:   actorSnapshot,
      target_snapshot:  targetSnapshot,
      diff:             args.diff ?? {},
      ip:               getClientIp(args.req),
      user_agent:       (args.req.headers.get("user-agent") ?? "").slice(0, 400),
      request_id:       args.req.headers.get("x-request-id"),
      previous_hash:    previousHash,
    };

    await supabaseAdmin.from("security_audit_events").insert({
      ...payload,
      event_hash: hashPayload(payload),
    });
  } catch (err) {
    // Audit failure should not make a successful security action fail.
    console.error("[security_audit_events] insert failed:", (err as Error).message);
  }
}
