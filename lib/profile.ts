// lib/profile.ts
// UserProfile interface and DB-backed profile builder.

import { type SessionPayload } from "./auth";
import { supabaseAdmin } from "./supabase/server";
import { getEffectiveFlags } from "./effective-flags";
import { type SessionStatus } from "./types/user";
import { type UserId, asUserId } from "./types/ids";
import { type Permission } from "./types/permission";

// ─── Interface ────────────────────────────────────────────────
export interface UserProfile {
  id:            UserId;       // branded UUID — compile-time type safety for ID comparisons
  displayId:     number;       // sequential integer — e.g. 1, 2, 3
  displayName:   string;       // human-readable name — letters, numbers, one space max
  email:         string;
  username:      string;
  role:          string;
  accessFlags:   Permission[]; // typed union — typos caught at compile time
  sessionStatus: SessionStatus;
  lastLoginIp:   string;
  lastActive:    string;
  sessionStart:  number;
}

// ─── DB row type ──────────────────────────────────────────────
interface ProfileRow {
  display_id:     number;
  display_name:   string;
  username:       string;
  access_flags:   string[];
  session_status: string;
  last_login_ip:  string;
  last_active:    string;
}

// ─── Defaults ─────────────────────────────────────────────────
const DEFAULT: ProfileRow = {
  display_id:     0,
  display_name:   "",
  username:       "unknown",
  access_flags:   [],
  session_status: "OFFLINE",
  last_login_ip:  "0.0.0.0",
  last_active:    new Date().toISOString(),
};

// ─── Builder ──────────────────────────────────────────────────
export async function buildProfile(session: SessionPayload): Promise<UserProfile> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_id, display_name, username, access_flags, session_status, last_login_ip, last_active")
    .eq("id", session.id)
    .single();

  const row = (data as ProfileRow | null) ?? DEFAULT;

  // Effective flags = own flags ∪ role permissions (typed at DB boundary)
  const effectiveFlags = await getEffectiveFlags(asUserId(session.id));

  return {
    id:            asUserId(session.id), // cast at boundary — UserId inside the app
    displayId:     row.display_id,
    displayName:   row.display_name ?? "",
    email:         session.email,
    username:      row.username,
    role:          session.role.toUpperCase(),
    accessFlags:   effectiveFlags,
    sessionStatus: (row.session_status as SessionStatus) ?? "OFFLINE",
    lastLoginIp:   row.last_login_ip,
    lastActive:    row.last_active,
    sessionStart:  Date.now(),
  };
}
