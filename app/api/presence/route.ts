// app/api/presence/route.ts
// POST   /api/presence          — heartbeat: mark current user ONLINE
// GET    /api/presence?ids=...  — return ONLINE/OFFLINE for a comma-separated list of user IDs
// DELETE /api/presence          — mark current user OFFLINE (called on tab close / sign-out)
//
// Online threshold: last_active within 2 minutes AND session_status = 'ONLINE'

import { NextRequest, NextResponse } from "next/server";
import { getSession }    from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

const ONLINE_THRESHOLD_MS = 25 * 1000; // 25 s — must be > heartbeat interval (10 s)

// ── POST — heartbeat ───────────────────────────────────────────
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      session_status: "ONLINE",
      last_active:    new Date().toISOString(),
    })
    .eq("id", session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── GET — bulk presence lookup ─────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids      = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, session_status, last_active")
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const result: Record<string, "ONLINE" | "OFFLINE"> = {};

  for (const p of data ?? []) {
    const lastActive = new Date(p.last_active as string).getTime();
    const fresh      = now - lastActive < ONLINE_THRESHOLD_MS;
    result[p.id as string] = (p.session_status === "ONLINE" && fresh) ? "ONLINE" : "OFFLINE";
  }

  return NextResponse.json(result);
}

// ── DELETE — mark offline ──────────────────────────────────────
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Zero out last_active so the stale-check also detects offline immediately,
  // even when only last_active freshness is evaluated.
  await supabaseAdmin
    .from("profiles")
    .update({
      session_status: "OFFLINE",
      last_active:    new Date(0).toISOString(), // epoch — always stale
    })
    .eq("id", session.id);

  return NextResponse.json({ ok: true });
}
