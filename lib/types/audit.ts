export interface AuditPrincipal {
  id: string;
  label: string;
  username?: string | null;
  displayName?: string | null;
  displayId?: number | null;
}

export interface AuditTarget {
  type: string;
  id: string | null;
  label: string;
  username?: string | null;
  displayName?: string | null;
  displayId?: number | null;
}

export interface AuditSnapshot {
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

export type AuditDiff = Record<string, {
  before: unknown;
  after: unknown;
}>;

export interface AuditEvent {
  id: string;
  occurredAt: string;
  action: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  actorUserId: string | null;
  actorSessionId: string | null;
  actor: AuditPrincipal | null;
  targetType: string;
  targetId: string | null;
  target: AuditTarget;
  actorSnapshot: AuditSnapshot;
  targetSnapshot: AuditSnapshot;
  diff: AuditDiff;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  previousHash: string | null;
  eventHash: string | null;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
  nextCursor: string | null;
}
