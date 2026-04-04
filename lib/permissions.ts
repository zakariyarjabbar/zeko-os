// lib/permissions.ts
// Permission guard helpers.
// Permissions are now dynamic DB records — no hardcoded flag list.
// "Administrator" is the system superuser permission.

export const ADMIN_PERMISSION = "Administrator";

// Administrator = has the "Administrator" permission flag
export function isFounder(accessFlags: string[]): boolean {
  return accessFlags.includes(ADMIN_PERMISSION);
}

export function hasPermission(accessFlags: string[], flag: string): boolean {
  return accessFlags.includes(ADMIN_PERMISSION) || accessFlags.includes(flag);
}
