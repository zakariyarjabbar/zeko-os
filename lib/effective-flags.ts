// lib/effective-flags.ts
// Returns the effective permission flags for a user:
//   own access_flags  ∪  all permissions from their assigned roles
//
// This is the single source of truth for all permission checks.
// Every API route and server layout must use this instead of
// reading access_flags directly.

import { supabaseAdmin } from "./supabase/server";

interface ProfileRow  { access_flags: string[] }
interface UserRoleRow { role_id: string }
interface RoleRow     { permissions: string[] }

export async function getEffectiveFlags(userId: string): Promise<string[]> {
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

  if (roleIds.length === 0) return [...new Set(ownFlags)];

  // 3. Permissions from each role
  const { data: roles } = await supabaseAdmin
    .from("roles")
    .select("permissions")
    .in("id", roleIds);

  const roleFlags = (roles ?? []).flatMap((r: RoleRow) => r.permissions ?? []);

  // 4. Union — deduplicated
  return [...new Set([...ownFlags, ...roleFlags])];
}
