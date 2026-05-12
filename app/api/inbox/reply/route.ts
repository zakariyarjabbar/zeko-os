// app/api/inbox/reply/route.ts
// POST /api/inbox/reply - send email reply (inbox-manager | Administrator)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { canManageInbox } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";
import { logSecurityAuditEvent } from "@/lib/audit";
import { enforcePersistentRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const InboxReplySchema = z.object({
  messageId: z.string().uuid("Invalid message id.").optional(),
  to: z.string().trim().email("Invalid recipient email.").max(254),
  subject: z.string().trim().min(1, "Subject is required.").max(180),
  replyBody: z.string().trim().min(1, "Reply body is required.").max(8000),
  originalName: z.string().trim().max(120).optional(),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!canManageInbox(ids)) {
    return NextResponse.json({ error: "Forbidden. inbox-manager permission required." }, { status: 403 });
  }

  const limited = await enforcePersistentRateLimit({
    req,
    scope: "inbox:reply",
    limit: 30,
    windowSeconds: 3600,
    identifier: session.id,
  });
  if (limited) return limited;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const parsed = InboxReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }
  const { messageId, to, subject, replyBody, originalName } = parsed.data;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email service not configured. Add RESEND_API_KEY to .env.local." },
      { status: 503 },
    );
  }

  const safeRecipient = escapeHtml(originalName ?? to);
  const safeReplyBody = escapeHtml(replyBody).replace(/\n/g, "<br/>");
  const safeSender = escapeHtml(session.name ?? "Zeko OS");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: "Zeko OS <onboarding@resend.dev>",
      to: [to],
      subject: `Re: ${subject}`,
      html: `
        <div style="font-family:monospace;background:#050505;color:#F0F6F0;padding:32px;border-radius:8px;border:1px solid rgba(0,255,65,0.2);">
          <p style="color:#00FF41;margin-bottom:16px;">// ZEKO OS - REPLY TRANSMISSION</p>
          <p style="color:#8B9E8B;margin-bottom:8px;">Hi ${safeRecipient},</p>
          <div style="border-left:2px solid #00FF41;padding-left:16px;margin:16px 0;color:#F0F6F0;">
            ${safeReplyBody}
          </div>
          <p style="color:#6B7A6B;font-size:12px;margin-top:24px;border-top:1px solid rgba(0,255,65,0.12);padding-top:16px;">
            - ${safeSender} - Zeko OS
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    console.error("[reply] resend error:", await res.json());
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  await logSecurityAuditEvent({
    req,
    actor: session,
    action: "inbox.reply",
    targetType: "inbox_message",
    targetId: messageId ?? null,
    metadata: {
      to,
      subject,
      originalName: originalName ?? null,
      replyLength: replyBody.length,
    },
    targetSnapshot: {
      id: messageId ?? null,
      label: subject || to,
      name: originalName ?? null,
      email: to,
      subject,
    },
  });

  return NextResponse.json({ ok: true });
}
