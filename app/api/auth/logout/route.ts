// app/api/auth/logout/route.ts
// POST /api/auth/logout
// Clears the session cookie.

import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
