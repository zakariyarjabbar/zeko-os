// lib/types/user.ts
// Canonical User type used across the system.
// display_id follows the format: <role>-<sequence>  e.g. root-1, operator-2

export type SessionStatus = "ONLINE" | "AWAY" | "OFFLINE";

export interface UserIdentity {
  username:    string;   // short handle e.g. "zeko"
  firstName:   string;
  lastName:    string;
  email:       string;
  permissions: string[]; // e.g. ["ROOT_ACCESS", "SYS_ADMIN"]
}

export interface UserSession {
  status:      SessionStatus;
  lastLoginIp: string;
  lastActive:  string; // ISO-8601
}

export interface User {
  id:          string;       // Supabase UUID — immutable, internal
  displayId:   string;       // role-based sequential ID e.g. "root-1"
  identity:    UserIdentity;
  session:     UserSession;
}
