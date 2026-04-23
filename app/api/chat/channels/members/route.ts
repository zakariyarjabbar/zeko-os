// app/api/chat/channels/members/route.ts
// GET /api/chat/channels/members?channel=<channelId>
// Returns { count: number } — online users who can view the channel.
//
// access_flags and roles.permissions now store permission UUIDs.
// All comparisons are UUID-based (rename-safe).

import { NextRequest, NextResponse } from "next/server";
import { getSession }    from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

const ONLINE_THRESHOLD_MS = 60 * 1000;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = req.nextUrl.searchParams.get("channel");
  if (!channelId) return NextResponse.json({ error: "Missing channel" }, { status: 400 });

  const since = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString();

  // Fetch channel config + Administrator UUID + online profiles in parallel
  const [channelRes, adminPermRes, onlineProfilesRes] = await Promise.all([
    supabaseAdmin
      .from("channels")
      .select("public, view_permission")
      .eq("id", channelId)
      .single(),

    supabaseAdmin
      .from("permissions")
      .select("id")
      .eq("name", "Administrator")
      .single(),

    supabaseAdmin
      .from("profiles")
      .select("id, access_flags")
      .eq("session_status", "ONLINE")
      .gte("last_active", since),
  ]);

  if (channelRes.error) return NextResponse.json({ error: channelRes.error.message }, { status: 500 });

  const isPublic      = (channelRes.data as { public: boolean; view_permission: string | null } | null)?.public ?? false;
  const viewPermId    = (channelRes.data as { public: boolean; view_permission: string | null } | null)?.view_permission ?? null;
  const adminPermId   = (adminPermRes.data as { id: string } | null)?.id ?? null;
  const onlineProfiles = onlineProfilesRes.data ?? [];

  if (onlineProfiles.length === 0) return NextResponse.json({ count: 0 });

  // Public channel — every online user counts
  if (isPublic) return NextResponse.json({ count: onlineProfiles.length });

  const onlineIds = onlineProfiles.map((p: { id: string }) => p.id);

  // Role assignments for online users → role UUIDs
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role_id")
    .in("user_id", onlineIds);

  const involvedRoleIds = [...new Set((userRoles ?? []).map(
    (ur: { user_id: string; role_id: string }) => ur.role_id,
  ))];

  // Role permission UUID arrays
  const rolePermMap = new Map<string, string[]>();
  if (involvedRoleIds.length > 0) {
    const { data: roles } = await supabaseAdmin
      .from("roles")
      .select("id, permissions")
      .in("id", involvedRoleIds);

    for (const r of roles ?? []) {
      rolePermMap.set(r.id as string, (r.permissions as string[]) ?? []);
    }
  }

  // user_id → role_ids map
  const userRoleIds = new Map<string, string[]>();
  for (const ur of userRoles ?? []) {
    const existing = userRoleIds.get(ur.user_id) ?? [];
    existing.push(ur.role_id);
    userRoleIds.set(ur.user_id, existing);
  }

  // Count users whose effective UUID set includes Administrator or the channel's view permission
  let count = 0;
  for (const p of onlineProfiles) {
    const ownIds: string[]  = (p.access_flags as string[]) ?? [];
    const myRoleIds         = userRoleIds.get(p.id as string) ?? [];
    const roleIds: string[] = myRoleIds.flatMap((rid) => rolePermMap.get(rid) ?? []);
    const effective         = [...ownIds, ...roleIds];

    const isAdmin   = adminPermId ? effective.includes(adminPermId) : false;
    const canView   = viewPermId  ? effective.includes(viewPermId)  : false;

    if (isAdmin || canView) count++;
  }

  return NextResponse.json({ count });
}
