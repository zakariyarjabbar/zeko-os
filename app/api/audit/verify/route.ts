// app/api/audit/verify/route.ts
// GET /api/audit/verify - administrator-only audit hash-chain verification.

import { NextRequest } from "next/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { isFounder } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, badRequest, forbidden, internalError, requireSession } from "@/lib/api";
import { auditEventHash } from "@/lib/audit";

const MAX_VERIFY_ROWS = 10_000;

interface AuditVerifyIssue {
  id: string;
  type: "missing_hash" | "hash_mismatch" | "chain_mismatch";
  message: string;
}

interface AuditVerifyResponse {
  checked: number;
  hashed: number;
  unhashed: number;
  ok: boolean;
  firstIssueId: string | null;
  lastCheckedId: string | null;
  issues: AuditVerifyIssue[];
}

function parseLimit(req: NextRequest): number {
  const raw = req.nextUrl.searchParams.get("limit");
  if (!raw) return MAX_VERIFY_ROWS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return MAX_VERIFY_ROWS;
  return Math.min(Math.max(parsed, 1), MAX_VERIFY_ROWS);
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function expectedHash(row: Record<string, unknown>): string {
  return auditEventHash({
    actor_user_id:    typeof row.actor_user_id === "string" ? row.actor_user_id : null,
    actor_session_id: typeof row.actor_session_id === "string" ? row.actor_session_id : null,
    action:           String(row.action),
    target_type:      String(row.target_type),
    target_id:        typeof row.target_id === "string" ? row.target_id : null,
    severity:         typeof row.severity === "string" ? row.severity : "info",
    metadata:         jsonObject(row.metadata),
    actor_snapshot:   jsonObject(row.actor_snapshot),
    target_snapshot:  jsonObject(row.target_snapshot),
    diff:             jsonObject(row.diff),
    ip:               typeof row.ip === "string" ? row.ip : null,
    user_agent:       typeof row.user_agent === "string" ? row.user_agent : null,
    request_id:       typeof row.request_id === "string" ? row.request_id : null,
    previous_hash:    typeof row.previous_hash === "string" ? row.previous_hash : null,
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids)) {
    return forbidden("Forbidden. Administrator permission required.", req);
  }

  const limit = parseLimit(req);
  const afterId = req.nextUrl.searchParams.get("afterId");
  if (afterId && !/^\d+$/.test(afterId)) return badRequest("Invalid afterId.", req);

  let query = supabaseAdmin
    .from("security_audit_events")
    .select("id, actor_user_id, actor_session_id, action, severity, target_type, target_id, metadata, actor_snapshot, target_snapshot, diff, ip, user_agent, request_id, previous_hash, event_hash")
    .order("id", { ascending: true })
    .limit(limit);

  if (afterId) query = query.gt("id", afterId);

  const { data, error } = await query;
  if (error) {
    console.error("[audit/verify] query error:", error.message);
    return internalError(req);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const issues: AuditVerifyIssue[] = [];
  let previousHash: string | null = null;
  let hashed = 0;
  let unhashed = 0;

  for (const row of rows) {
    const id = String(row.id);
    const eventHash = typeof row.event_hash === "string" ? row.event_hash : null;
    const rowPreviousHash = typeof row.previous_hash === "string" ? row.previous_hash : null;

    if (!eventHash) {
      unhashed += 1;
      if (previousHash) {
        issues.push({
          id,
          type: "missing_hash",
          message: "This row was inserted after a hashed row but does not have event_hash.",
        });
      }
      continue;
    }

    hashed += 1;
    if (rowPreviousHash !== previousHash) {
      issues.push({
        id,
        type: "chain_mismatch",
        message: "previous_hash does not match the previous hashed event.",
      });
    }

    const recomputed = expectedHash(row);
    if (recomputed !== eventHash) {
      issues.push({
        id,
        type: "hash_mismatch",
        message: "event_hash does not match the event payload.",
      });
    }

    previousHash = eventHash;
  }

  const firstIssueId = issues[0]?.id ?? null;
  const last = rows[rows.length - 1];

  return apiOk<AuditVerifyResponse>({
    checked: rows.length,
    hashed,
    unhashed,
    ok: issues.length === 0,
    firstIssueId,
    lastCheckedId: last ? String(last.id) : null,
    issues: issues.slice(0, 100),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
