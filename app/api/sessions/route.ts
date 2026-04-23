// app/api/sessions/route.ts
// GET    /api/sessions              — list all active sessions for the caller
// DELETE /api/sessions?scope=others — revoke every session except the current one
//
// Both endpoints require a valid session (getSession() must resolve).
// They only ever touch rows for the caller's own user_id — a session
// cookie is the authorisation.  There is no admin-level endpoint here;
// revoking someone else's session is not exposed to the UI.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listSessionsForUser,
  revokeAllOthersForUser,
} from "@/lib/sessions";
import { formatDeviceLabel } from "@/lib/user-agent";

// ── Serializer ──────────────────────────────────────────────────
// Only ship safe, display-ready fields to the client. The raw UA
// string is never sent (some UAs contain tracking ids or tokens
// prepended by network middleware); we send a short device label.

function serialize(
  row: { id: string; created_at: string; last_active: string; expires_at: string;
         ip: string | null; user_agent: string | null; persist: boolean },
  currentSid: string,
) {
  return {
    id:         row.id,
    current:    row.id === currentSid,
    device:     formatDeviceLabel(row.user_agent),
    ip:         row.ip ?? "unknown",
    createdAt:  row.created_at,
    lastActive: row.last_active,
    expiresAt:  row.expires_at,
    persist:    row.persist,
  };
}

// ── GET ─────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await listSessionsForUser(session.id);
  return NextResponse.json({
    currentSid: session.sid,
    sessions:   rows.map((r) => serialize(r, session.sid)),
  });
}

// ── DELETE ──────────────────────────────────────────────────────
// Only ?scope=others is supported here. Revoking a single specific
// session goes through /api/sessions/[id].

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get("scope");
  if (scope !== "others") {
    return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
  }

  await revokeAllOthersForUser(session.id, session.sid);
  return NextResponse.json({ ok: true });
}
