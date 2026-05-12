// app/api/presence/route.ts
// POST   /api/presence          - heartbeat: mark current user ONLINE
// GET    /api/presence?ids=...  - return ONLINE/OFFLINE for comma-separated user IDs
// DELETE /api/presence          - mark current user OFFLINE

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { z } from "zod";

const ONLINE_THRESHOLD_MS = 25 * 1000;
const IdsSchema = z.array(z.string().uuid()).max(100);

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      session_status: "ONLINE",
      last_active: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const parsed = IdsSchema.safeParse(idsParam.split(",").map((s) => s.trim()).filter(Boolean));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ids." }, { status: 400 });

  const ids = parsed.data;
  if (ids.length === 0) return NextResponse.json({});

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, session_status, last_active")
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const result: Record<string, "ONLINE" | "OFFLINE"> = {};
  const staleIds: string[] = [];

  for (const p of data ?? []) {
    const lastActiveMs = new Date(p.last_active as string).getTime();
    const fresh = !Number.isNaN(lastActiveMs) && now - lastActiveMs < ONLINE_THRESHOLD_MS;

    if ((p.session_status as string) === "ONLINE" && !fresh) {
      staleIds.push(p.id as string);
      result[p.id as string] = "OFFLINE";
    } else {
      result[p.id as string] = (p.session_status === "ONLINE" && fresh) ? "ONLINE" : "OFFLINE";
    }
  }

  if (staleIds.length > 0) {
    void supabaseAdmin
      .from("profiles")
      .update({ session_status: "OFFLINE" })
      .in("id", staleIds);
  }

  return NextResponse.json(result);
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabaseAdmin
    .from("profiles")
    .update({
      session_status: "OFFLINE",
      last_active: new Date().toISOString(),
    })
    .eq("id", session.id);

  return NextResponse.json({ ok: true });
}
