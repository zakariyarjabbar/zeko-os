// lib/effective-flags.ts
// Returns the effective permission flags for a user:
//   own access_flags  ∪  all permissions from their assigned roles
//
// This is the single source of truth for all permission checks.
// Every API route and server layout must use this instead of
// reading access_flags directly.

import { supabaseAdmin } from "./supabase/server";
import type { UserId }                from "./types/ids";
import { type Permission, asPermission } from "./types/permission";

interface ProfileRow  { access_flags: string[] }
interface UserRoleRow { role_id: string }
interface RoleRow     { permissions: string[] }

/**
 * Compute the full effective permission set for `userId`.
 * Reads the user's own `access_flags` plus every permission granted by their
 * assigned roles, deduplicates the union, and casts to `Permission[]` at the
 * DB boundary so downstream code is fully typed.
 *
 * @param userId  Branded UserId — prevents accidentally passing a ChannelId etc.
 * @returns       Deduplicated, typed permission array.
 */
export async function getEffectiveFlags(userId: UserId): Promise<Permission[]> {
  // 1. Own flags
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("access_flags")
    .eq("id", userId)
    .single();

  const ownFlags: string[] = (profile as ProfileRow | null)?.access_flags ?? [];

  // 2. Roles assigned to this user
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);

  const roleIds = (userRoles ?? []).map((ur: UserRoleRow) => ur.role_id);

  if (roleIds.length === 0) {
    return [...new Set(ownFlags)].map(asPermission);
  }

  // 3. Permissions from each role
  const { data: roles } = await supabaseAdmin
    .from("roles")
    .select("permissions")
    .in("id", roleIds);

  const roleFlags = (roles ?? []).flatMap((r: RoleRow) => r.permissions ?? []);

  // 4. Union — deduplicated, cast at DB boundary
  return [...new Set([...ownFlags, ...roleFlags])].map(asPermission);
}
