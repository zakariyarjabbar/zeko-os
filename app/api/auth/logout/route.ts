// app/api/auth/logout/route.ts
// POST /api/auth/logout
// Marks user OFFLINE in DB, then clears the session cookie.

import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST() {
  const session = await getSession();

  if (session?.id) {
    // Mark OFFLINE immediately — don't wait for the 25-second stale check.
    await supabaseAdmin
      .from("profiles")
      .update({ session_status: "OFFLINE", last_active: new Date().toISOString() })
      .eq("id", session.id);
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
