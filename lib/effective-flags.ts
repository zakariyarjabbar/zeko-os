// lib/effective-flags.ts
// Returns the effective permission set for a user.
//
// Storage layer: profiles.access_flags and roles.permissions now store
// permission UUIDs (not name strings). This makes permission checks
// rename-safe — renaming a permission in the permissions table does NOT
// break access control because UUIDs never change.
//
// Application layer: all hardcoded checks (userFlags.includes("Administrator"))
// still work because getEffectiveFlags() resolves UUIDs → names on the fly.
//
// Use getEffectivePermissions() when you need BOTH names (for hardcoded checks)
// and raw IDs (for UUID-based channel access checks) in one round-trip.

import { supabaseAdmin } from "./supabase/server";
import type { UserId }                from "./types/ids";
import { type Permission, asPermission } from "./types/permission";

interface ProfileRow  { access_flags: string[] }   // UUID strings
interface UserRoleRow { role_id: string }
interface RoleRow     { permissions: string[] }     // UUID strings
interface PermRow     { name: string }

export interface EffectivePermissions {
  /** Permission name strings — for all existing hardcoded checks like includes("Administrator") */
  flags: Permission[];
  /** Raw permission UUIDs — for rename-safe ID-based checks (channel view/delete) */
  ids:   string[];
}

/**
 * Fetch the user's full permission set in one call.
 * Reads UUID arrays from profiles.access_flags + role permissions,
 * then resolves them to name strings via a single permissions table JOIN.
 */
export async function getEffectivePermissions(userId: UserId): Promise<EffectivePermissions> {
  // 1. Own UUID flags + role assignments — parallel
  const [profileRes, userRolesRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("access_flags").eq("id", userId).single(),
    supabaseAdmin.from("user_roles").select("role_id").eq("user_id", userId),
  ]);

  const ownIds: string[]  = (profileRes.data as ProfileRow | null)?.access_flags ?? [];
  const roleIds: string[] = (userRolesRes.data ?? []).map((ur: UserRoleRow) => ur.role_id);

  // 2. Permissions from each assigned role
  let rolePermIds: string[] = [];
  if (roleIds.length > 0) {
    const { data: roles } = await supabaseAdmin
      .from("roles")
      .select("permissions")
      .in("id", roleIds);
    rolePermIds = (roles ?? []).flatMap((r: RoleRow) => r.permissions ?? []);
  }

  const allIds = [...new Set([...ownIds, ...rolePermIds])];

  if (allIds.length === 0) return { flags: [], ids: [] };

  // 3. Resolve UUIDs → permission names in one query
  const { data: permRows } = await supabaseAdmin
    .from("permissions")
    .select("name")
    .in("id", allIds);

  const flags = (permRows ?? []).map((p: PermRow) => asPermission(p.name));

  return { flags, ids: allIds };
}

/**
 * Backward-compatible wrapper — returns only name strings.
 * Use when you only need hardcoded string checks (most routes).
 */
export async function getEffectiveFlags(userId: UserId): Promise<Permission[]> {
  const { flags } = await getEffectivePermissions(userId);
  return flags;
}
