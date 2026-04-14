// app/api/profile/route.ts
// PATCH /api/profile — authenticated user updates their own display_name.
// No special permissions required — any logged-in user may call this.

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = (body.displayName ?? "").trim();

  if (!raw) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }
  if ((raw.match(/ /g) ?? []).length > 1) {
    return NextResponse.json(
      { error: "Display name may contain at most one space." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ display_name: raw })
    .eq("id", session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
