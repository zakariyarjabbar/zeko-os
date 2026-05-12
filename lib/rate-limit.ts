// lib/rate-limit.ts
// DB-backed fixed-window rate limiting for Route Handlers.

import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/password-reset";
import { rateLimited } from "@/lib/api";

export interface PersistentRateLimitVerdict {
  ok: boolean;
  retryInSeconds: number;
  count: number;
  limit: number;
  resetAt: string | null;
}

function cleanPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_.@-]/g, "_")
    .slice(0, 160);
}

export async function checkPersistentRateLimit(args: {
  req: NextRequest;
  scope: string;
  limit: number;
  windowSeconds: number;
  identifier?: string | null;
}): Promise<PersistentRateLimitVerdict> {
  const ip = getClientIp(args.req);
  const identity = args.identifier?.trim() || ip;
  const bucketKey = [
    cleanPart(args.scope),
    cleanPart(identity),
  ].join(":");

  const { data, error } = await supabaseAdmin.rpc("hit_api_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: args.limit,
    p_window_seconds: args.windowSeconds,
  });

  if (error) {
    console.error("[api_rate_limits] rpc failed:", error.message);
    return {
      ok: false,
      retryInSeconds: Math.max(1, args.windowSeconds),
      count: args.limit + 1,
      limit: args.limit,
      resetAt: null,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: row?.allowed === true,
    retryInSeconds: Number(row?.retry_after_seconds ?? args.windowSeconds),
    count: Number(row?.current_count ?? 0),
    limit: Number(row?.limit_count ?? args.limit),
    resetAt: typeof row?.reset_at === "string" ? row.reset_at : null,
  };
}

export async function enforcePersistentRateLimit(args: {
  req: NextRequest;
  scope: string;
  limit: number;
  windowSeconds: number;
  identifier?: string | null;
  message?: string;
}) {
  const verdict = await checkPersistentRateLimit(args);
  if (verdict.ok) return null;

  return rateLimited(
    args.message ?? "Too many requests. Please wait before trying again.",
    verdict.retryInSeconds,
    args.req,
  );
}
