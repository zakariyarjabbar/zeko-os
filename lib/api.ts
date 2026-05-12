// lib/api.ts
// Shared API response helpers for Route Handlers.

import { NextRequest, NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export interface ApiProblem {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export function requestId(req?: NextRequest): string {
  return req?.headers.get("x-request-id") || crypto.randomUUID();
}

export function apiOk<T>(
  data: T,
  init?: ResponseInit & { requestId?: string },
): NextResponse<T> {
  const headers = new Headers(init?.headers);
  if (init?.requestId) headers.set("x-request-id", init.requestId);
  return NextResponse.json(data, { ...init, headers });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  init?: ResponseInit & {
    details?: Record<string, unknown>;
    requestId?: string;
  },
): NextResponse {
  const rid = init?.requestId || crypto.randomUUID();
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", rid);

  const problem: ApiProblem = {
    code,
    message,
    requestId: rid,
    ...(init?.details ? { details: init.details } : {}),
  };

  return NextResponse.json(
    {
      error: message,
      problem,
    },
    { status, headers },
  );
}

export function badRequest(message: string, req?: NextRequest, details?: Record<string, unknown>) {
  return apiError("bad_request", message, 400, { requestId: requestId(req), details });
}

export function unauthorized(req?: NextRequest) {
  return apiError("unauthorized", "Unauthorized.", 401, { requestId: requestId(req) });
}

export function forbidden(message = "Forbidden.", req?: NextRequest) {
  return apiError("forbidden", message, 403, { requestId: requestId(req) });
}

export function conflict(message: string, req?: NextRequest) {
  return apiError("conflict", message, 409, { requestId: requestId(req) });
}

export function rateLimited(message: string, retryInSeconds: number, req?: NextRequest) {
  return apiError("rate_limited", message, 429, {
    requestId: requestId(req),
    headers: { "Retry-After": String(retryInSeconds) },
    details: { retryInSeconds },
  });
}

export function internalError(req?: NextRequest) {
  return apiError("internal_error", "Internal server error.", 500, { requestId: requestId(req) });
}

export async function requireSession(
  req?: NextRequest,
): Promise<{ ok: true; session: SessionPayload } | { ok: false; response: NextResponse }> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized(req) };
  return { ok: true, session };
}
