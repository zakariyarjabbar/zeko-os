// lib/validations/chat.ts
// Zod schemas for all chat payloads.
// Imported by both API routes (server) and optionally by the client for
// pre-flight validation before the network call is made.
//
// SECURITY LAYERS (applied in order):
//   1. HTML tag stripping       — prevents XSS if output ever enters an HTML context
//   2. Control-char sanitisation — removes null bytes and non-printable characters
//   3. Zero-width char removal  — removes invisible Unicode used in homoglyph attacks
//   4. Newline normalisation    — caps consecutive blank lines (prevents message bombing)
//   5. Trim                     — no leading/trailing whitespace in stored bodies
//   6. Length enforcement       — enforced by Zod AFTER sanitisation (not before),
//                                 so a payload that sanitises down to 0 chars is
//                                 rejected cleanly rather than stored as whitespace

import { z } from "zod";

const MAX_BODY     = 4_000;
const MAX_NEWLINES = 2; // max consecutive blank lines

// ── Shared sanitiser ──────────────────────────────────────────

/**
 * Multi-layer text sanitiser applied to every user-supplied message body.
 * See module comment for the full ordered pipeline.
 */
const safeText = z.string().transform((s) =>
  s
    // 1. Strip HTML tags (defence against XSS if the body is ever rendered raw)
    .replace(/<[^>]*>/g, "")
    // 2. Remove null bytes and non-printable ASCII control chars (keep \n \r \t)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // 3. Remove zero-width and invisible Unicode characters (homoglyph / spoofing)
    .replace(/[\u200B-\u200D\u2028\u2029\u2060\uFEFF]/g, "")
    // 4. Normalise excessive blank lines (3+ consecutive newlines → 2)
    .replace(/\n{3,}/g, "\n".repeat(MAX_NEWLINES))
    // 5. Trim leading/trailing whitespace
    .trim()
);

/** Channel IDs are kebab-case ASCII slugs — no path separators or shell chars. */
const channelIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Channel ID must contain only lowercase letters, numbers, and hyphens.");

// ── Channel messages ──────────────────────────────────────────

export const SendChannelMessageSchema = z.object({
  channelId: channelIdSchema,
  text: safeText.pipe(
    z.string()
      .min(1,        "Message cannot be empty.")
      .max(MAX_BODY, `Message must be ${MAX_BODY} characters or fewer.`)
  ),
});

export type SendChannelMessageInput = z.infer<typeof SendChannelMessageSchema>;

// ── Direct messages ───────────────────────────────────────────

export const SendDMSchema = z.object({
  toUserId: z.string().uuid("Invalid recipient ID."),
  text: safeText.pipe(
    z.string()
      .min(1,        "Message cannot be empty.")
      .max(MAX_BODY, `Message must be ${MAX_BODY} characters or fewer.`)
  ),
});

export type SendDMInput = z.infer<typeof SendDMSchema>;

// ── SSE stream params ─────────────────────────────────────────

export const ChannelStreamSchema = z.object({
  type:  z.literal("channel"),
  id:    channelIdSchema,
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
