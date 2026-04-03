// lib/profile.ts
// UserProfile interface and mock profile builder.
// buildProfile() takes the SessionPayload already in the cookie and
// enriches it with display-layer fields. When a real DB exists,
// only this function needs to change — the UI stays the same.

import { type SessionPayload } from "./auth";

// ─── Interface ────────────────────────────────────────────────
export interface UserProfile {
  id:             string;
  email:          string;
  name:           string;
  alias:          string;
  role:           string;
  clearanceLevel: string;
  department:     string;
  nodeAssignment: string;
  accessFlags:    string[];
  sessionStart:   number;   // Unix ms — used to compute live uptime
}

// ─── Mock enrichment table ────────────────────────────────────
// Keyed by user ID. Provides the fields that don't come from auth.
const PROFILE_ENRICHMENT: Record<string, Omit<UserProfile,
  "id" | "email" | "name" | "role" | "sessionStart"
>> = {
  u001: {
    alias:          "zeko",
    clearanceLevel: "LEVEL-5 / SOVEREIGN",
    department:     "Core Systems",
    nodeAssignment: "NODE-ALPHA-01",
    accessFlags:    ["ROOT", "DEPLOY", "AUDIT", "KEY_ROTATE", "THREAT_OPS"],
  },
  u002: {
    alias:          "n.cross",
    clearanceLevel: "LEVEL-3 / ELEVATED",
    department:     "Operations",
    nodeAssignment: "NODE-BETA-03",
    accessFlags:    ["DEPLOY", "AUDIT", "MONITOR"],
  },
  u003: {
    alias:          "c.wraight",
    clearanceLevel: "LEVEL-2 / STANDARD",
    department:     "Engineering",
    nodeAssignment: "NODE-DEV-07",
    accessFlags:    ["DEPLOY", "READ_LOGS"],
  },
};

// Fallback for unknown IDs
const DEFAULT_ENRICHMENT: Omit<UserProfile,
  "id" | "email" | "name" | "role" | "sessionStart"
> = {
  alias:          "unknown",
  clearanceLevel: "LEVEL-1 / RESTRICTED",
  department:     "Unassigned",
  nodeAssignment: "NODE-UNKNOWN",
  accessFlags:    ["READ_LOGS"],
};

// ─── Builder ──────────────────────────────────────────────────
export function buildProfile(session: SessionPayload): UserProfile {
  const enrichment = PROFILE_ENRICHMENT[session.id] ?? DEFAULT_ENRICHMENT;
  return {
    id:           session.id,
    email:        session.email,
    name:         session.name,
    role:         session.role.toUpperCase(),
    sessionStart: Date.now(),
    ...enrichment,
  };
}
