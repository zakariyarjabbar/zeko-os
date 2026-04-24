// lib/require-founder.ts
// Server-side guard: verifies effective permission IDs include Administrator.

import { getSession } from "./auth";
import { getEffectivePermissions } from "./effective-flags";
import { isFounder } from "./permissions";
import { asUserId } from "./types/ids";
import { NextResponse } from "next/server";

export async function requireFounder(): Promise<
  | { ok: true;  sessionId: string }
  | { ok: false; error: Response }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as unknown as Response };
  }

  const { ids } = await getEffectivePermissions(asUserId(session.id));

  if (!isFounder(ids)) {
    return { ok: false, error: NextResponse.json({ error: "Forbidden. Administrator permission required." }, { status: 403 }) as unknown as Response };
  }

  return { ok: true, sessionId: session.id };
}
