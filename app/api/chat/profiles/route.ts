// app/api/chat/profiles/route.ts
// GET /api/chat/profiles?ids=id1,id2,id3
// Lightweight batch profile lookup — returns the CURRENT display_name and
// username for each requested userId.  Any authenticated user may call this.

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { z }                         from "zod";

const IdsSchema = z.array(z.string().uuid()).max(100);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const parsed = IdsSchema.safeParse(raw.split(",").map((s) => s.trim()).filter(Boolean));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ids." }, { status: 400 });
  const ids = parsed.data;

  if (ids.length === 0) return NextResponse.json({});

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, username")
    .in("id", ids);

  const map: Record<string, { displayName: string; username: string }> = {};
  for (const p of (data ?? [])) {
    map[p.id as string] = {
      displayName: (p.display_name as string) ?? "",
      username:    (p.username    as string) ?? "",
    };
  }

  return NextResponse.json(map);
}
