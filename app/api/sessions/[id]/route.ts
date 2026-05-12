// app/api/sessions/[id]/route.ts
// DELETE /api/sessions/:id  — revoke a single session row.
//
// Ownership is enforced by matching the row's user_id against the
// caller's session. A user can only revoke their own sessions.
//
// Revoking the CURRENT session also clears the cookie — the response
// doubles as a logout for that device.

import { NextRequest, NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import {
  getSessionRowForUser,
  revokeSession,
} from "@/lib/sessions";
import { logSecurityAuditEvent } from "@/lib/audit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: targetSid } = await params;
  if (!targetSid) {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 });
  }

  // Ownership check: the row must belong to the caller. Rather than
  // doing a WHERE user_id = current-user on the UPDATE (which silently
  // succeeds on a non-matching id), we fetch first so we can return a
  // 404 for an unknown id vs 204 for a successful revoke. This also
  // prevents a user from probing for the existence of another user's
  // session ids.
  const row = await getSessionRowForUser(targetSid, session.id);
  if (!row) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  await revokeSession(targetSid);
  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "session.revoke",
    targetType: "session",
    targetId: targetSid,
    metadata: {
      current: targetSid === session.sid,
    },
  });

  // If the user revoked the device they're currently on, also clear
  // the cookie so the next request re-renders as logged-out instead
  // of thrashing through getSession → resolve → null.
  if (targetSid === session.sid) {
    await clearSession();
    return NextResponse.json({ ok: true, loggedOut: true });
  }

  return NextResponse.json({ ok: true });
}
