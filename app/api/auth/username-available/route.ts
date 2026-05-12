// app/api/auth/username-available/route.ts
// GET /api/auth/username-available?username=foo
// Public — used by the signup form to show live availability feedback.
// Returns { available: boolean, reason?: "empty" | "format" | "taken" }.
// Format rules are the same as /api/profile (PATCH username).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { enforcePersistentRateLimit } from "@/lib/rate-limit";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/;

export async function GET(req: NextRequest) {
  const limited = await enforcePersistentRateLimit({
    req,
    scope: "auth:username_available",
    limit: 120,
    windowSeconds: 900,
  });
  if (limited) return limited;

  const raw = (req.nextUrl.searchParams.get("username") ?? "")
    .trim()
    .toLowerCase();

  if (!raw) {
    return NextResponse.json({ available: false, reason: "empty" });
  }
  if (!USERNAME_RE.test(raw)) {
    return NextResponse.json({ available: false, reason: "format" });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", raw)
    .maybeSingle();

  if (error) {
    console.error("[username-available] db error:", error.message);
    return NextResponse.json({ available: false, reason: "error" }, { status: 500 });
  }

  return NextResponse.json(
    data ? { available: false, reason: "taken" } : { available: true },
  );
}
