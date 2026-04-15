// lib/validations/chat.ts
// Zod schemas for all chat payloads.
// Imported by both API routes (server) and optionally by the client for
// pre-flight validation before the network call is made.

import { z } from "zod";

const MAX_BODY = 4_000;

// ── Shared ────────────────────────────────────────────────────

/** Strip null bytes and non-printable control chars (keep \n \r \t). */
const safeText = z
  .string()
  .transform((s) =>
    // eslint-disable-next-line no-control-regex
    s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()
  );

// ── Channel messages ──────────────────────────────────────────

export const SendChannelMessageSchema = z.object({
  channelId: z.string().min(1).max(120),
  text: safeText.pipe(
    z.string()
      .min(1,       "Message cannot be empty.")
      .max(MAX_BODY, `Message must be ${MAX_BODY} characters or fewer.`)
  ),
});

export type SendChannelMessageInput = z.infer<typeof SendChannelMessageSchema>;

// ── Direct messages ───────────────────────────────────────────

export const SendDMSchema = z.object({
  toUserId: z.string().uuid("Invalid recipient ID."),
  text: safeText.pipe(
    z.string()
      .min(1,       "Message cannot be empty.")
      .max(MAX_BODY, `Message must be ${MAX_BODY} characters or fewer.`)
  ),
});

export type SendDMInput = z.infer<typeof SendDMSchema>;

// ── SSE stream params ─────────────────────────────────────────

export const ChannelStreamSchema = z.object({
  type:  z.literal("channel"),
  id:    z.string().min(1).max(120),
  since: z.string().datetime({ offset: true }).optional(),
});

export const DMStreamSchema = z.object({
  type:  z.literal("dm"),
  with:  z.string().uuid("Invalid user ID."),
  since: z.string().datetime({ offset: true }).optional(),
});

export const StreamParamsSchema = z.discriminatedUnion("type", [
  ChannelStreamSchema,
  DMStreamSchema,
]);
