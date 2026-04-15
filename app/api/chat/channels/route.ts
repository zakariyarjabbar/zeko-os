// app/api/chat/channels/route.ts
// GET /api/chat/channels
// Returns channels the user can view, with their permission keys
// and a live online member count (users with the view flag who are
// currently active within the 60-second presence window).

import { NextResponse } from "next/server";
import { getSession }        from "@/lib/auth";
import { supabaseAdmin }     from "@/lib/supabase/server";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { asUserId } from "@/lib/types/ids";
import { asPermission, channelPerm } from "@/lib/types/permission";

const ONLINE_THRESHOLD_MS = 60 * 1000;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userFlags = await getEffectiveFlags(asUserId(session.id));
  const isAdmin   = userFlags.includes("Administrator");

  // Run all three queries in parallel
  const [channelsRes, permsRes, onlineRes] = await Promise.all([
    supabaseAdmin
      .from("channels")
      .select("id, label, topic")
      .order("created_at", { ascending: true }),

    supabaseAdmin
      .from("channel_permissions")
      .select("channel_id, permission"),

    // Fetch every online profile's access_flags so we can count
    // per-channel without N+1 queries.
    supabaseAdmin
      .from("profiles")
      .select("access_flags, session_status, last_active")
      .eq("session_status", "ONLINE")
      .gte("last_active", new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString()),
  ]);

  if (channelsRes.error) return NextResponse.json({ error: channelsRes.error.message }, { status: 500 });

  // Build permission map: channelId → [permissions]
  const permMap: Record<string, string[]> = {};
  (permsRes.data ?? []).forEach((p: { channel_id: string; permission: string }) => {
    permMap[p.channel_id] ??= [];
    permMap[p.channel_id].push(p.permission);
  });

  // For each online profile, cache whether they're an admin and which
  // view flags they hold — used in the per-channel count below.
  type OnlineProfile = { access_flags: string[]; session_status: string; last_active: string };
  const onlineProfiles: OnlineProfile[] = onlineRes.data ?? [];

  const result = (channelsRes.data ?? []).map((c) => {
    const chPerms   = permMap[c.id] ?? [];
    const viewFlag  = `view:${c.id}`;

    // Permissions this requesting user holds for this channel
    const userChPerms = isAdmin
      ? chPerms
      : chPerms.filter((p) => userFlags.includes(asPermission(p)));

    // Count distinct online users who can view this channel
    const viewPerm = channelPerm("view", c.id);
    const onlineCount = onlineProfiles.filter((p) =>
      p.access_flags.includes("Administrator") || p.access_flags.includes(viewPerm)
    ).length;

    return {
      id:          c.id,
      label:       c.label,
      topic:       c.topic,
      memberCount: onlineCount,
      permissions: userChPerms,
    };
  });

  return NextResponse.json(result);
}
