// app/api/profile/route.ts
// GET  /api/profile — returns current user's effective access flags.
// PATCH /api/profile — authenticated user updates their own display_name.
// No special permissions required — any logged-in user may call these.

import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession }    from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { getEffectiveFlags }         from "@/lib/effective-flags";
import { asUserId }                  from "@/lib/types/ids";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accessFlags = await getEffectiveFlags(asUserId(session.id));
  return NextResponse.json({ accessFlags });
}

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

  // Keep the session cookie in sync so session.name reflects the new name
  // immediately — without this the header shows the old name until next login.
  await setSession({ ...session, name: raw });

  return NextResponse.json({ ok: true });
}
