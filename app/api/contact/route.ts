// app/api/contact/route.ts
// POST /api/contact — saves a contact form submission to the DB.
// Public endpoint — no auth required (landing page form).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Invalid email address.").max(254).transform((value) => value.toLowerCase()),
  subject: z.string().trim().min(1, "Subject is required.").max(160),
  message: z.string().trim().min(1, "Message is required.").max(5000),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }
  const { name, email, subject, message } = parsed.data;

  const { error } = await supabaseAdmin
    .from("contact_messages")
    .insert({ name, email, subject, message });

  if (error) {
    console.error("[contact] insert:", error.message);
    return NextResponse.json({ error: "Failed to save message." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
