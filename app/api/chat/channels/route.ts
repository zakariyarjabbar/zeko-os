// app/api/chat/channels/route.ts
// GET /api/chat/channels
// Returns channels filtered to ones the user can view,
// with their available permission keys.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectiveFlags } from "@/lib/effective-flags";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userFlags = await getEffectiveFlags(session.id);
  const isAdmin = userFlags.includes("Administrator");

  const { data: channels, error } = await supabaseAdmin
    .from("channels")
    .select("id, label, topic, member_count")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch all channel_permissions
  const { data: perms } = await supabaseAdmin
    .from("channel_permissions")
    .select("channel_id, permission");

  const permMap: Record<string, string[]> = {};
  (perms ?? []).forEach((p: { channel_id: string; permission: string }) => {
    permMap[p.channel_id] = [...(permMap[p.channel_id] ?? []), p.permission];
  });

  const result = (channels ?? []).map((c) => {
    const chPerms = permMap[c.id] ?? [];
    // Which permissions does this user have for this channel?
    const userChPerms = isAdmin
      ? chPerms  // admin has all
      : chPerms.filter((p) => userFlags.includes(p));

    return {
      id:          c.id,
      label:       c.label,
      topic:       c.topic,
      memberCount: c.member_count,
      permissions: userChPerms,
    };
  });

  return NextResponse.json(result);
}
