// app/api/chat/typing/route.ts
// POST /api/chat/typing — upsert an ephemeral typing indicator.
//
// The row expires implicitly: the SSE stream filters rows where
// updated_at > now() - 5 s, so entries that haven't been refreshed
// within that window are automatically invisible to other clients.
//
// Body: { context: "channel:<id>" | "dm:<uuidA>:<uuidB>", handle: string }
//
// Security:
//   • Only the authenticated user can write their own row (RLS + server check).
//   • Context is validated to prevent arbitrary strings.

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { supabaseAdmin }             from "@/lib/supabase/server";
import { z }                         from "zod";

const TypingSchema = z.object({
  context: z.string().min(1).max(300).regex(
    /^(channel:[a-z0-9-]+|dm:[0-9a-f-]{36}:[0-9a-f-]{36})$/,
    "Invalid typing context format.",
  ),
  handle: z.string().max(60).default(""),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid body." }, { status: 400 }); }

  const parsed = TypingSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }
  const { context, handle } = parsed.data;

  const { error } = await supabaseAdmin
    .from("typing_indicators")
    .upsert(
      { user_id: session.id, context, handle, updated_at: new Date().toISOString() },
      { onConflict: "user_id,context" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
