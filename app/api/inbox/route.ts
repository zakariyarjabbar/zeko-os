// app/api/inbox/route.ts
// GET    /api/inbox          — list messages  (inbox-view | inbox-manager | Administrator)
// DELETE /api/inbox?id=uuid  — delete message (inbox-manager | Administrator)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { asUserId } from "@/lib/types/ids";
import { canViewInbox, canManageInbox } from "@/lib/permissions";
import { logSecurityAuditEvent } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!canViewInbox(ids)) {
    return NextResponse.json({ error: "Forbidden. inbox-view or inbox-manager permission required." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .select("id, name, email, subject, message, read, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!canManageInbox(ids)) {
    return NextResponse.json({ error: "Forbidden. inbox-manager permission required." }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const { data: beforeMessage } = await supabaseAdmin
    .from("contact_messages")
    .select("id, name, email, subject")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("contact_messages")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const before = beforeMessage as {
    id: string;
    name: string | null;
    email: string | null;
    subject: string | null;
  } | null;
  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "inbox.delete",
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
    diff: { deleted: { before: true, after: false } },
  });

  return NextResponse.json({ ok: true });
}
