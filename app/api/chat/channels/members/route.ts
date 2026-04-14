// app/api/chat/channels/members/route.ts
// GET /api/chat/channels/members?channel=<channelId>
// Returns { count: number } — number of currently online users who can view
// the given channel (via own flags OR role-inherited flags).

import { NextRequest, NextResponse } from "next/server";
import { getSession }    from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

const ONLINE_THRESHOLD_MS = 60 * 1000; // must match presence route

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = req.nextUrl.searchParams.get("channel");
  if (!channelId) return NextResponse.json({ error: "Missing channel" }, { status: 400 });

  const viewFlag = `view:${channelId}`;
  const since    = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString();

  // ── 1. All online profiles (id + own access_flags) ──────────
  const { data: onlineProfiles, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, access_flags")
    .eq("session_status", "ONLINE")
    .gte("last_active", since);

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  if (!onlineProfiles || onlineProfiles.length === 0) return NextResponse.json({ count: 0 });

  const onlineIds = onlineProfiles.map((p: { id: string }) => p.id);

  // ── 2. Role assignments for those users ─────────────────────
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role_id")
    .in("user_id", onlineIds);

  const involvedRoleIds = [...new Set((userRoles ?? []).map(
    (ur: { user_id: string; role_id: string }) => ur.role_id,
  ))];

  // ── 3. Permissions for those roles ──────────────────────────
  let rolePermMap = new Map<string, string[]>();
  if (involvedRoleIds.length > 0) {
    const { data: roles } = await supabaseAdmin
      .from("roles")
      .select("id, permissions")
      .in("id", involvedRoleIds);

    for (const r of roles ?? []) {
      rolePermMap.set(r.id as string, (r.permissions as string[]) ?? []);
    }
  }

  // ── 4. Build user → role_ids map ────────────────────────────
  const userRoleIds = new Map<string, string[]>();
  for (const ur of userRoles ?? []) {
    const existing = userRoleIds.get(ur.user_id) ?? [];
    existing.push(ur.role_id);
    userRoleIds.set(ur.user_id, existing);
  }

  // ── 5. Count users whose effective flags include access ──────
  let count = 0;
  for (const p of onlineProfiles) {
    const ownFlags: string[]  = (p.access_flags as string[]) ?? [];
    const myRoleIds: string[] = userRoleIds.get(p.id as string) ?? [];
    const roleFlags: string[] = myRoleIds.flatMap((rid) => rolePermMap.get(rid) ?? []);
    const effective = [...ownFlags, ...roleFlags];

    if (effective.includes("Administrator") || effective.includes(viewFlag)) {
      count++;
    }
  }

  return NextResponse.json({ count });
}
