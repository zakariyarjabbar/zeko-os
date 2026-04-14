// lib/permissions.ts
// Permission guard helpers.
// Permissions are dynamic DB records — no hardcoded list.

export const ADMIN_PERMISSION = "Administrator";

// Has Administrator flag
export function isFounder(flags: string[]): boolean {
  return flags.includes(ADMIN_PERMISSION);
}

// General flag check — Administrator bypasses everything
export function hasPermission(flags: string[], flag: string): boolean {
  return flags.includes(ADMIN_PERMISSION) || flags.includes(flag);
}

// ─── Named permission checks ──────────────────────────────────

export function canViewInbox(flags: string[]): boolean {
  return flags.includes(ADMIN_PERMISSION)
    || flags.includes("inbox-manager")
    || flags.includes("view-inbox");
}

export function canManageInbox(flags: string[]): boolean {
  return flags.includes(ADMIN_PERMISSION) || flags.includes("inbox-manager");
}

// Can list users (moderator, admin, Administrator)
export function canViewUsers(flags: string[]): boolean {
  return flags.includes(ADMIN_PERMISSION)
    || flags.includes("admin")
    || flags.includes("moderator");
}

// Can create users (admin, Administrator — not moderator)
export function canCreateUsers(flags: string[]): boolean {
  return flags.includes(ADMIN_PERMISSION) || flags.includes("admin");
}

// Can edit a user's profile
// moderator: limited fields only (username, password)
// admin/Administrator: all fields, but blocked on Administrator-flagged targets
export function canEditUsers(flags: string[]): boolean {
  return flags.includes(ADMIN_PERMISSION)
    || flags.includes("admin")
    || flags.includes("moderator");
}

// Can delete a user (admin, Administrator — not moderator)
export function canDeleteUsers(flags: string[]): boolean {
  return flags.includes(ADMIN_PERMISSION) || flags.includes("admin");
}

// Moderator-only fields (subset of edit)
export const MODERATOR_EDITABLE_FIELDS = new Set([
  "username", "password",
]);
