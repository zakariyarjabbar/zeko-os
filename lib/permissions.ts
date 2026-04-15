// lib/permissions.ts
// Permission guard helpers.
// Permissions are dynamic DB records — no hardcoded list except the names below.
// All functions accept readonly arrays to enforce that they never mutate the flags.

import { type Permission, type SystemFlag, type ChannelAction, channelPerm } from "./types/permission";

export const ADMIN_PERMISSION: SystemFlag = "Administrator";

// ─── Core guards ──────────────────────────────────────────────

/** True if `flags` contains the unrestricted Administrator flag. */
export function isFounder(flags: readonly Permission[]): boolean {
  return flags.includes(ADMIN_PERMISSION);
}

/**
 * True if `flags` contains `flag` OR the Administrator override.
 * Use the typed overloads below for named checks — this is the escape hatch
 * for dynamically composed permissions (e.g. channel-scoped at runtime).
 */
export function hasPermission(flags: readonly Permission[], flag: Permission): boolean {
  return flags.includes(ADMIN_PERMISSION) || flags.includes(flag);
}

/**
 * True if `flags` grants the given channel action on `channelId`.
 * Equivalent to `hasPermission(flags, channelPerm(action, channelId))`.
 *
 * @example  hasChannelPermission(flags, "view", "global-ops")
 */
export function hasChannelPermission(
  flags:     readonly Permission[],
  action:    ChannelAction,
  channelId: string,
): boolean {
  return hasPermission(flags, channelPerm(action, channelId));
}

// ─── Named permission checks ──────────────────────────────────

export function canViewInbox(flags: readonly Permission[]): boolean {
  return flags.includes(ADMIN_PERMISSION)
    || flags.includes("inbox-manager")
    || flags.includes("view-inbox");
}

export function canManageInbox(flags: readonly Permission[]): boolean {
  return flags.includes(ADMIN_PERMISSION) || flags.includes("inbox-manager");
}

/** Can list users — moderator, admin, Administrator. */
export function canViewUsers(flags: readonly Permission[]): boolean {
  return flags.includes(ADMIN_PERMISSION)
    || flags.includes("admin")
    || flags.includes("moderator");
}

/** Can create users — admin and Administrator only (not moderator). */
export function canCreateUsers(flags: readonly Permission[]): boolean {
  return flags.includes(ADMIN_PERMISSION) || flags.includes("admin");
}

/**
 * Can edit a user's profile.
 * - moderator:      limited fields only (see MODERATOR_EDITABLE_FIELDS)
 * - admin/Admin:    all fields, but blocked on Administrator-flagged targets
 */
export function canEditUsers(flags: readonly Permission[]): boolean {
  return flags.includes(ADMIN_PERMISSION)
    || flags.includes("admin")
    || flags.includes("moderator");
}

/** Can delete a user — admin and Administrator only (not moderator). */
export function canDeleteUsers(flags: readonly Permission[]): boolean {
  return flags.includes(ADMIN_PERMISSION) || flags.includes("admin");
}

// ─── Constants ────────────────────────────────────────────────

/** Fields a moderator is permitted to update on another user's profile. */
export const MODERATOR_EDITABLE_FIELDS = new Set<string>([
  "username",
  "password",
]);
