import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WINDOW_MS = 60_000;
const DEFAULT_MUTATION_LIMIT = 120;
const PUBLIC_MUTATION_LIMIT = 20;
const HIGH_VOLUME_PATH_LIMITS: Record<string, number> = {
  "/api/chat/typing": 240,
  "/api/presence": 240,
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

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

function configuredOrigins(): Set<string> {
  return new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function sameOrigin(req: NextRequest): boolean {
  if (!MUTATING_METHODS.has(req.method)) return true;

  const origin = req.headers.get("origin");
  if (origin) {
    if (origin === req.nextUrl.origin) return true;
    return configuredOrigins().has(origin);
  }

  const referer = req.headers.get("referer");
  if (!referer) return false;

  let refererOrigin: string;
  try {
    refererOrigin = new URL(referer).origin;
  } catch {
    return false;
  }

  if (refererOrigin === req.nextUrl.origin) return true;
  return configuredOrigins().has(refererOrigin);
}

function mutationLimit(pathname: string): number {
  if (HIGH_VOLUME_PATH_LIMITS[pathname]) return HIGH_VOLUME_PATH_LIMITS[pathname];
  if (pathname.startsWith("/api/contact")) return PUBLIC_MUTATION_LIMIT;
  if (pathname.startsWith("/api/auth/")) return 60;
  return DEFAULT_MUTATION_LIMIT;
}

function rateLimit(req: NextRequest): NextResponse | null {
  if (!MUTATING_METHODS.has(req.method)) return null;

  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  const pathname = req.nextUrl.pathname;
  const limit = mutationLimit(pathname);
  const key = `${getClientIp(req)}:${req.method}:${pathname}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  const retryInSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  return NextResponse.json(
    {
      error: "Too many requests. Please wait before trying again.",
      problem: {
        code: "rate_limited",
        message: "Too many requests. Please wait before trying again.",
        requestId,
        details: { retryInSeconds },
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryInSeconds),
        "x-request-id": requestId,
      },
    },
  );
}

export function proxy(req: NextRequest) {
  if (!sameOrigin(req)) {
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
    return NextResponse.json(
      {
        error: "Cross-origin API request blocked.",
        problem: {
          code: "forbidden",
          message: "Cross-origin API request blocked.",
          requestId,
        },
      },
      {
        status: 403,
        headers: { "x-request-id": requestId },
      },
    );
  }

  const limited = rateLimit(req);
  if (limited) return limited;

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
