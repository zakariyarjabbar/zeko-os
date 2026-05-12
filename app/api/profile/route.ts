// app/api/profile/route.ts
// GET   /api/profile — current user's effective access flags
// PATCH /api/profile — update display_name, username, or change password
// No special permissions required — any logged-in user may call these.

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { getSession }                from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { getEffectivePermissions }    from "@/lib/effective-flags";
import { asUserId }                  from "@/lib/types/ids";
import { revokeAllOthersForUser }    from "@/lib/sessions";
import { logSecurityAuditEvent, type SecurityAuditDiff } from "@/lib/audit";

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids, flags: flagNames } = await getEffectivePermissions(asUserId(session.id));
  return NextResponse.json({ accessFlags: ids, accessFlagNames: flagNames });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    displayName?:     string;
    username?:        string;
    currentPassword?: string;
    newPassword?:     string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ── Password change ───────────────────────────────────────────────────────
  if (body.currentPassword !== undefined || body.newPassword !== undefined) {
    if (!body.currentPassword)
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    if (!body.newPassword || body.newPassword.length < 8)
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });

    // Verify the current password with the anon client before allowing the change
    const { error: signInErr } = await anonClient().auth.signInWithPassword({
      email:    session.email,
      password: body.currentPassword,
    });
    if (signInErr)
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(session.id, {
      password: body.newPassword,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // A successful password change forcibly signs the user out of every
    // other device. The current session stays valid so the UI can show
    // "password updated" without kicking them out of the tab they're on.
    await revokeAllOthersForUser(session.id, session.sid);

    await logSecurityAuditEvent({
      req,
      actor: session,
      action: "profile.password_change",
      targetType: "user",
      targetId: session.id,
      severity: "high",
      diff: {
        password: { before: "set", after: "changed" },
        otherSessions: { before: "active", after: "revoked" },
      },
    });

    return NextResponse.json({ ok: true });
  }

  // ── Profile field update (displayName and/or username) ───────────────────
  const profileUpdate: Record<string, unknown> = {};

  if (body.displayName !== undefined) {
    const raw = body.displayName.trim();
    if (!raw)
      return NextResponse.json({ error: "Display name is required." }, { status: 400 });
    if ((raw.match(/ /g) ?? []).length > 1)
      return NextResponse.json(
        { error: "Display name may contain at most one space." },
        { status: 400 },
      );
    profileUpdate.display_name = raw;
  }

  if (body.username !== undefined) {
    const raw = body.username.trim().toLowerCase();
    if (!raw)
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    if (!/^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/.test(raw))
      return NextResponse.json(
        { error: "3–20 chars: lowercase letters, numbers, dots, dashes, underscores." },
        { status: 400 },
      );

    // Uniqueness check — exclude the current user
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", raw)
      .neq("id", session.id)
      .maybeSingle();
    if (taken)
      return NextResponse.json({ error: "Username is already taken." }, { status: 400 });

    profileUpdate.username = raw;
  }

  if (Object.keys(profileUpdate).length === 0)
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });

  const { data: beforeProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, display_id, display_name, username")
    .eq("id", session.id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const diff: SecurityAuditDiff = {};
  const before = beforeProfile as {
    id: string;
    display_id: number | null;
    display_name: string | null;
    username: string | null;
  } | null;
  if (Object.hasOwn(profileUpdate, "display_name")) {
    diff.displayName = {
      before: before?.display_name ?? null,
      after: profileUpdate.display_name,
    };
  }
  if (Object.hasOwn(profileUpdate, "username")) {
    diff.username = {
      before: before?.username ?? null,
      after: profileUpdate.username,
    };
  }

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "profile.update",
    targetType: "user",
    targetId: session.id,
    diff,
  });

  // (No cookie re-issue needed: display_name is resolved fresh from the
  // profiles table on every getSession() call — the cookie holds only
  // the session id, not a display-name snapshot.)

  return NextResponse.json({ ok: true });
}
