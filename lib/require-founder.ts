// lib/require-founder.ts
// Server-side guard: reads session + profile, returns 403 if not founder.
// Returns { session, profile } on success, { error: Response } on failure.

import { getSession } from "./auth";
import { supabaseAdmin } from "./supabase/server";
import { isFounder } from "./permissions";
import { NextResponse } from "next/server";

interface ProfileFlags {
  access_flags: string[];
}

export async function requireFounder(): Promise<
  | { ok: true;  sessionId: string }
  | { ok: false; error: Response }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as unknown as Response };
  }

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("access_flags")
    .eq("id", session.id)
    .single();

  const flags = (data as ProfileFlags | null)?.access_flags ?? [];

  if (!isFounder(flags)) {
    return { ok: false, error: NextResponse.json({ error: "Forbidden. ROOT_ACCESS required." }, { status: 403 }) as unknown as Response };
  }

  return { ok: true, sessionId: session.id };
}
