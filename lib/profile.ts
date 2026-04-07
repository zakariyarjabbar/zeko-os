// lib/profile.ts
// UserProfile interface and DB-backed profile builder.

import { type SessionPayload } from "./auth";
import { supabaseAdmin } from "./supabase/server";
import { getEffectiveFlags } from "./effective-flags";
import { type SessionStatus } from "./types/user";

// ─── Interface ────────────────────────────────────────────────
export interface UserProfile {
  id:            string;
  displayId:     string;
  email:         string;
  username:      string;
  firstName:     string;
  lastName:      string;
  role:          string;
  alias:         string;
  department:    string;
  accessFlags:   string[];
  sessionStatus: SessionStatus;
  lastLoginIp:   string;
  lastActive:    string;
  sessionStart:  number;
}

// ─── DB row type ──────────────────────────────────────────────
interface ProfileRow {
  display_id:     string;
  username:       string;
  first_name:     string;
  last_name:      string;
  alias:          string;
  department:     string;
  access_flags:   string[];
  session_status: string;
  last_login_ip:  string;
  last_active:    string;
}

// ─── Defaults ─────────────────────────────────────────────────
const DEFAULT: ProfileRow = {
  display_id:     "user-0",
  username:       "unknown",
  first_name:     "",
  last_name:      "",
  alias:          "unknown",
  department:     "Unassigned",
  access_flags:   ["READ_LOGS"],
  session_status: "OFFLINE",
  last_login_ip:  "0.0.0.0",
  last_active:    new Date().toISOString(),
};

// ─── Builder ──────────────────────────────────────────────────
export async function buildProfile(session: SessionPayload): Promise<UserProfile> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select(
      "display_id, username, first_name, last_name, alias, department, access_flags, session_status, last_login_ip, last_active"
    )
    .eq("id", session.id)
    .single();

  const row = (data as ProfileRow | null) ?? DEFAULT;

  // Effective flags = own flags ∪ role permissions
  const effectiveFlags = await getEffectiveFlags(session.id);

  return {
    id:            session.id,
    displayId:     row.display_id,
    email:         session.email,
    username:      row.username,
    firstName:     row.first_name,
    lastName:      row.last_name,
    role:          session.role.toUpperCase(),
    alias:         row.alias,
    department:    row.department,
    accessFlags:   effectiveFlags,
    sessionStatus: (row.session_status as SessionStatus) ?? "OFFLINE",
    lastLoginIp:   row.last_login_ip,
    lastActive:    row.last_active,
    sessionStart:  Date.now(),
  };
}
