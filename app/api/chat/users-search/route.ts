// app/api/chat/users-search/route.ts
// GET /api/chat/users-search?q=query
// Search users by username, first_name, last_name, or email.
// Used for starting new DM conversations.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  // Search profiles
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, username, first_name, last_name, session_status")
    .or(`username.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .neq("id", session.id)  // exclude self
    .limit(10);

  // Also search by email via auth
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
  const emailMatches = (authData?.users ?? [])
    .filter((u) => u.email?.toLowerCase().includes(q) && u.id !== session.id)
    .map((u) => u.id);

  // Merge: profiles matching name/username + profiles for email matches
  const profileIds = new Set([
    ...(profiles ?? []).map((p: { id: string }) => p.id),
    ...emailMatches,
  ]);

  if (profileIds.size === 0) return NextResponse.json([]);

  const { data: merged } = await supabaseAdmin
    .from("profiles")
    .select("id, username, first_name, last_name, session_status")
    .in("id", [...profileIds]);

  // Attach emails
  const emailMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email]));

  const result = (merged ?? []).map((p: {
    id: string; username: string; first_name: string; last_name: string; session_status: string;
  }) => ({
    id:       p.id,
    username: p.username,
    name:     `${p.first_name} ${p.last_name}`.trim() || p.username,
    email:    emailMap.get(p.id) ?? "",
    status:   p.session_status,
  }));

  return NextResponse.json(result);
}
