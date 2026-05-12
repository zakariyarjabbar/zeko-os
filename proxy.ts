import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
