// lib/types/permission.ts
// Type-safe permission system for Zeko OS.
//
// Every permission is either a top-level system flag ("Administrator")
// or a channel-scoped action ("view:global-ops", "delete-msg:security-alerts").
//
// Using a union type instead of bare `string` means the compiler catches typos
// like "Admnistrator" or "vew:global-ops" at build time, not in production.

// ── System-level flags ────────────────────────────────────────────────────────

/** Top-level privilege flags that are not scoped to any resource. */
export type SystemFlag =
  | "Administrator"  // unrestricted — bypasses every other permission check
  | "admin"          // manage users, roles, channels (blocked on Administrator targets)
  | "moderator"      // limited moderation: username/password only, cannot delete users
  | "inbox-manager"  // full contact-inbox management (read + delete)
  | "view-inbox";    // read-only access to the contact inbox

// ── Channel-scoped permissions ────────────────────────────────────────────────

/** Actions that can be performed inside a channel. */
export type ChannelAction =
  | "view"        // read messages in the channel
  | "send"        // post messages in the channel
  | "delete-msg"  // remove any message in the channel
  | "manage";     // edit channel settings (topic, description)

/**
 * Channel-scoped permission: `"action:channelId"` — e.g. `"view:global-ops"`.
 * Template literal type — the TypeScript compiler verifies the action prefix.
 */
export type ChannelPermission = `${ChannelAction}:${string}`;

// ── Union ─────────────────────────────────────────────────────────────────────

/** Every permission that can appear in a user's effective flag set. */
export type Permission = SystemFlag | ChannelPermission;

// ── Type guards ───────────────────────────────────────────────────────────────

export function isSystemFlag(p: Permission): p is SystemFlag {
  return !p.includes(":");
}

export function isChannelPermission(p: Permission): p is ChannelPermission {
  return p.includes(":");
}

// ── Builder helpers ───────────────────────────────────────────────────────────

/**
 * Build a typed channel permission from its parts.
 * Prefer this over template literals in business logic to get IDE autocomplete.
 *
 * @example  channelPerm("view", "global-ops")  // → "view:global-ops"
 */
export function channelPerm(action: ChannelAction, channelId: string): ChannelPermission {
  return `${action}:${channelId}`;
}

/**
 * Decompose a channel permission into its action and channelId parts.
 *
 * @example  parseChannelPerm("delete-msg:global-ops")
 *           // → { action: "delete-msg", channelId: "global-ops" }
 */
export function parseChannelPerm(p: ChannelPermission): {
  action:    ChannelAction;
  channelId: string;
} {
  const colon = p.indexOf(":");
  return {
    action:    p.slice(0, colon) as ChannelAction,
    channelId: p.slice(colon + 1),
  };
}

// ── Boundary caster ───────────────────────────────────────────────────────────

/**
 * Cast a raw string from the DB or an API payload to `Permission`.
 * Use only at trust boundaries (reading `access_flags` from Supabase, etc.).
 * This is a type-only assertion — it does NOT validate the format at runtime.
 */
export const asPermission = (s: string): Permission => s as Permission;
