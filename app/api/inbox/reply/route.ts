// app/api/inbox/reply/route.ts
// POST /api/inbox/reply — send email reply (inbox-manager | Administrator)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { canManageInbox } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const flags = await getEffectiveFlags(session.id);
  if (!canManageInbox(flags)) {
    return NextResponse.json({ error: "Forbidden. inbox-manager permission required." }, { status: 403 });
  }

  let body: { to?: string; subject?: string; replyBody?: string; originalName?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const { to, subject, replyBody, originalName } = body;
  if (!to || !subject || !replyBody) {
    return NextResponse.json({ error: "to, subject, and replyBody are required." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email service not configured. Add RESEND_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      from:    "Zeko OS <onboarding@resend.dev>",
      to:      [to],
      subject: `Re: ${subject}`,
      html: `
        <div style="font-family:monospace;background:#050505;color:#F0F6F0;padding:32px;border-radius:8px;border:1px solid rgba(0,255,65,0.2);">
          <p style="color:#00FF41;margin-bottom:16px;">// ZEKO OS — REPLY TRANSMISSION</p>
          <p style="color:#8B9E8B;margin-bottom:8px;">Hi ${originalName ?? to},</p>
          <div style="border-left:2px solid #00FF41;padding-left:16px;margin:16px 0;color:#F0F6F0;">
            ${replyBody.replace(/\n/g, "<br/>")}
          </div>
          <p style="color:#6B7A6B;font-size:12px;margin-top:24px;border-top:1px solid rgba(0,255,65,0.12);padding-top:16px;">
            — ${session.name} · Zeko OS
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    console.error("[reply] resend error:", await res.json());
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
