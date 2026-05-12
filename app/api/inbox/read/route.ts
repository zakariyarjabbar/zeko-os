// app/api/inbox/read/route.ts
// PATCH /api/inbox/read?id=uuid — mark a message as read.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { canViewInbox } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";
import { logSecurityAuditEvent } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!canViewInbox(ids)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const { data: beforeMessage } = await supabaseAdmin
    .from("contact_messages")
    .select("id, name, email, subject, read")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("contact_messages")
    .update({ read: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const before = beforeMessage as {
    id: string;
    name: string | null;
    email: string | null;
    subject: string | null;
    read: boolean | null;
  } | null;
  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "inbox.read",
    targetType: "inbox_message",
    targetId: id,
    metadata: {
      name: before?.name ?? null,
      email: before?.email ?? null,
      subject: before?.subject ?? null,
    },
    targetSnapshot: {
      id,
      label: before?.subject ?? before?.email ?? id,
      name: before?.name ?? null,
      email: before?.email ?? null,
      subject: before?.subject ?? null,
    },
    diff: { read: { before: before?.read ?? false, after: true } },
  });

  return NextResponse.json({ ok: true });
}
