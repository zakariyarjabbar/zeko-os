// lib/types/user.ts
// Canonical User type used across the system.
// display_id is an auto-incrementing integer starting at 1 (assigned by DB sequence).

export type SessionStatus = "ONLINE" | "OFFLINE";

export interface UserIdentity {
  username:    string;   // short handle e.g. "zeko"
  email:       string;
  permissions: string[]; // e.g. ["Administrator", "view:global-ops"]
}

export interface UserSession {
  status:      SessionStatus;
  lastLoginIp: string;
  lastActive:  string; // ISO-8601
}

export interface User {
  id:        string;       // Supabase UUID — immutable, internal
  displayId: number;       // sequential display number e.g. 1, 2, 3
  identity:  UserIdentity;
  session:   UserSession;
}
