// app/api/chat/channels/route.ts
// GET    /api/chat/channels         — list channels visible to the user
// POST   /api/chat/channels         — create a channel (Administrator only)
// PATCH  /api/chat/channels         — edit a channel (Administrator only)
// DELETE /api/chat/channels?id=x    — delete a channel (manage:<id> or Administrator)

import { NextResponse, type NextRequest } from "next/server";
import { getSession }              from "@/lib/auth";
import { supabaseAdmin }           from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { asUserId }                from "@/lib/types/ids";
import { channelPerm }             from "@/lib/types/permission";

const ONLINE_THRESHOLD_MS = 60 * 1000;

function generateChannelId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "") || "channel";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug}-${suffix}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { flags: userFlags, ids: userPermIds } = await getEffectivePermissions(asUserId(session.id));
  const isAdmin = userFlags.includes("Administrator");

  // Fetch the Administrator permission UUID once — used for online count
  const { data: adminPermRow } = await supabaseAdmin
    .from("permissions")
    .select("id")
    .eq("name", "Administrator")
    .single();
  const adminPermId: string | null = (adminPermRow as { id: string } | null)?.id ?? null;

  const [channelsRes, permsRes, onlineRes] = await Promise.all([
    supabaseAdmin
      .from("channels")
      .select("id, label, topic, public, view_permission, delete_permission")
      .order("created_at", { ascending: true }),

    supabaseAdmin
      .from("channel_permissions")
      .select("channel_id, permission"),

    // access_flags now stores UUID strings
    supabaseAdmin
      .from("profiles")
      .select("access_flags")
      .eq("session_status", "ONLINE")
      .gte("last_active", new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString()),
  ]);

  if (channelsRes.error) return NextResponse.json({ error: channelsRes.error.message }, { status: 500 });

  // Legacy permission map (channel_permissions table) — stores name strings, kept for backward compat
  const legacyPermMap: Record<string, string[]> = {};
  (permsRes.data ?? []).forEach((p: { channel_id: string; permission: string }) => {
    legacyPermMap[p.channel_id] ??= [];
    legacyPermMap[p.channel_id].push(p.permission);
  });

  type OnlineProfile = { access_flags: string[] }; // UUID strings
  const onlineProfiles: OnlineProfile[] = onlineRes.data ?? [];

  const result = (channelsRes.data ?? []).map((c) => {
    const isPublic       = c.public ?? false;
    const viewPermId     = c.view_permission  as string | null; // UUID
    const deletePermId   = c.delete_permission as string | null; // UUID
    const legacyPerms    = legacyPermMap[c.id] ?? [];           // name strings (legacy)

    // ── Can this user view? ──────────────────────────────────
    // New channels: compare by UUID (rename-safe)
    // Legacy channels (channel_permissions table): compare by name string
    let canUserView: boolean;
    if (isAdmin || isPublic) {
      canUserView = true;
    } else if (viewPermId) {
      canUserView = userPermIds.includes(viewPermId);           // UUID check
    } else {
      canUserView = legacyPerms.some((p) => userFlags.includes(p as Parameters<typeof userFlags.includes>[0]));
    }

    // ── Synthetic permission list for the sidebar ────────────
    const userChPerms: string[] = [];
    if (canUserView) userChPerms.push(channelPerm("view", c.id));
    if (isAdmin || userFlags.includes(channelPerm("send",       c.id))) userChPerms.push(channelPerm("send",       c.id));
    if (isAdmin || userFlags.includes(channelPerm("delete-msg", c.id))) userChPerms.push(channelPerm("delete-msg", c.id));
    if (isAdmin || userFlags.includes(channelPerm("manage",     c.id))) userChPerms.push(channelPerm("manage",     c.id));

    // ── Online count ─────────────────────────────────────────
    // access_flags on profiles are now UUIDs, so compare by UUID
    const onlineCount = onlineProfiles.filter((p) => {
      if (adminPermId && p.access_flags.includes(adminPermId)) return true;
      if (isPublic) return true;
      if (viewPermId) return p.access_flags.includes(viewPermId);
      // Legacy: name-based (channel_permissions table)
      return legacyPerms.some((lp) => userFlags.includes(lp as Parameters<typeof userFlags.includes>[0]));
    }).length;

    return {
      id:               c.id,
      label:            c.label,
      topic:            c.topic ?? "",
      memberCount:      onlineCount,
      permissions:      userChPerms,
      isPublic,
      viewPermission:   viewPermId,
      deletePermission: deletePermId,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { flags } = await getEffectivePermissions(asUserId(session.id));
  if (!flags.includes("Administrator"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body             = await req.json().catch(() => null);
  const label            = (body?.label ?? "").trim();
  const topic            = (body?.topic ?? "").trim();
  const isPublic         = body?.isPublic === true;
  const viewPermission   = isPublic ? null : ((body?.viewPermission   ?? null) as string | null); // UUID
  const deletePermission = (body?.deletePermission ?? null) as string | null;                     // UUID

  if (!label || label.length > 64)
    return NextResponse.json({ error: "Label required (max 64 chars)" }, { status: 400 });
  if (topic.length > 256)
    return NextResponse.json({ error: "Topic too long (max 256 chars)" }, { status: 400 });

  let id = generateChannelId(label);
  const { error: insertErr } = await supabaseAdmin
    .from("channels")
    .insert({ id, label, topic, public: isPublic, view_permission: viewPermission, delete_permission: deletePermission });

  if (insertErr) {
    if (insertErr.code === "23505") {
      id = generateChannelId(label);
      const { error: retryErr } = await supabaseAdmin
        .from("channels")
        .insert({ id, label, topic, public: isPublic, view_permission: viewPermission, delete_permission: deletePermission });
      if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id, label, topic, isPublic, viewPermission, deletePermission }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { flags } = await getEffectivePermissions(asUserId(session.id));
  if (!flags.includes("Administrator"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body             = await req.json().catch(() => null);
  const id               = (body?.id    ?? "").trim();
  const label            = (body?.label ?? "").trim();
  const topic            = (body?.topic ?? "").trim();
  const isPublic         = body?.isPublic === true;
  const viewPermission   = isPublic ? null : ((body?.viewPermission   ?? null) as string | null);
  const deletePermission = (body?.deletePermission ?? null) as string | null;

  if (!id)    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!label || label.length > 64)
    return NextResponse.json({ error: "Label required (max 64 chars)" }, { status: 400 });
  if (topic.length > 256)
    return NextResponse.json({ error: "Topic too long (max 256 chars)" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("channels")
    .update({ label, topic, public: isPublic, view_permission: viewPermission, delete_permission: deletePermission })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id, label, topic, isPublic, viewPermission, deletePermission });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { flags, ids: userPermIds } = await getEffectivePermissions(asUserId(session.id));
  const isAdmin   = flags.includes("Administrator");

  // manage permission check — still name-based (channelPerm returns a name string)
  const canManage = isAdmin || flags.includes(channelPerm("manage", id));

  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Collect channel-scoped permission rows to purge (both id and name)
  const { data: permRows } = await supabaseAdmin
    .from("permissions")
    .select("id, name")
    .like("name", `%:${id}`);

  const scopedIds:   string[] = (permRows ?? []).map((r: { id: string; name: string }) => r.id);
  const scopedNames: string[] = (permRows ?? []).map((r: { id: string; name: string }) => r.name);

  void userPermIds; // not needed here but kept for consistency

  await Promise.all([
    supabaseAdmin.from("messages").delete().eq("channel_id", id),
    supabaseAdmin.from("channel_permissions").delete().eq("channel_id", id),
    ...(scopedIds.length > 0
      ? [
          // RPCs compare by UUID now (access_flags stores UUIDs)
          supabaseAdmin.rpc("remove_permissions_from_roles",    { perms: scopedIds }),
          supabaseAdmin.rpc("remove_permissions_from_profiles", { perms: scopedIds }),
          supabaseAdmin.from("permissions").delete().in("name", scopedNames),
        ]
      : []),
  ]);

  const { error } = await supabaseAdmin.from("channels").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: id });
}
