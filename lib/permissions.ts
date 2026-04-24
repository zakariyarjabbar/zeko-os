// lib/permissions.ts
// Permission guard helpers — UUID-based (rename-safe).
// All functions accept the raw permission UUID array (ids) from
// getEffectivePermissions(), never name strings.

import { PERM } from "./permission-ids";

// ── Core ──────────────────────────────────────────────────────

export function isFounder(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator);
}

export function hasPermission(ids: readonly string[], permId: string): boolean {
  return ids.includes(PERM.Administrator) || ids.includes(permId);
}

// ── Chat — channels ───────────────────────────────────────────

/** Overrides all per-channel restrictions — can view + delete in every channel. */
export function isChannelsManager(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator) || ids.includes(PERM.ChannelsManager);
}

/**
 * Can delete a specific message in a channel.
 * `flags` is the name-resolved list — needed for the dynamic per-channel
 * `delete-msg:<channelId>` check (channel IDs are stable so name-based is safe here).
 */
export function canDeleteChannelMessage(
  ids:       readonly string[],
  flags:     readonly string[],
  channelId: string,
  isOwn:     boolean,
): boolean {
  return isOwn
    || ids.includes(PERM.Administrator)
    || ids.includes(PERM.ChannelsManager)
    || flags.includes(`delete-msg:${channelId}`);
}

// ── Inbox ─────────────────────────────────────────────────────

export function canViewInbox(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator)
    || ids.includes(PERM.InboxView)
    || ids.includes(PERM.InboxManager);
}

export function canManageInbox(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator) || ids.includes(PERM.InboxManager);
}

// ── Users ─────────────────────────────────────────────────────

/** Can see the permissions/access_flags column in user records. */
export function canViewUserPermissions(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator) || ids.includes(PERM.PermissionManager);
}

/** Can open the edit panel for any user (has at least one management permission). */
export function canEditAnyUser(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator)
    || ids.includes(PERM.ChangeDisplayName)
    || ids.includes(PERM.PermissionManager)
    || ids.includes(PERM.RolesManager);
}

/** Can change a user's display name, username, or password. */
export function canChangeDisplayName(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator) || ids.includes(PERM.ChangeDisplayName);
}

/** Can change a user's access_flags and manage permission definitions. */
export function canManagePermissions(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator) || ids.includes(PERM.PermissionManager);
}

/** Can assign/remove roles and manage role definitions. */
export function canManageRoles(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator) || ids.includes(PERM.RolesManager);
}

/** Can create new user accounts. */
export function canCreateUsers(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator) || ids.includes(PERM.PermissionManager);
}

/** Can delete user accounts — Administrator only. */
export function canDeleteUsers(ids: readonly string[]): boolean {
  return ids.includes(PERM.Administrator);
}

// ── Legacy aliases ────────────────────────────────────────────

/** @deprecated use canEditAnyUser */
export function canViewUsers(ids: readonly string[]): boolean {
  return canEditAnyUser(ids);
}

export const MODERATOR_EDITABLE_FIELDS = new Set<string>(["username", "password"]);
