// lib/sessions.ts
// Server-side helpers for the user_sessions table.
//
// These are the only place that touches the table directly. Routes and
// lib/auth.ts call through here so the schema stays encapsulated.
//
// Lifecycle
// ─────────
// • createSession()  — login / signup / reset-verify
// • resolveSession() — every request; returns user data if the row is
//                      still active (not revoked, not expired). Also
//                      bumps last_active opportunistically (throttled
//                      in SQL — at most once per TOUCH_THROTTLE_SECONDS).
// • revokeSession()  — logout on this device, or "revoke" from the
//                      Active Sessions panel on another device.
// • revokeAllForUser() / revokeAllOthersForUser() — used after a
//                      password reset / change to invalidate any stolen
//                      cookies.

import { supabaseAdmin } from "@/lib/supabase/server";

// Mirrors lib/auth.ts
const SESSION_MAX_AGE         = 60 * 60 * 8;        // 8 hours
const SESSION_MAX_AGE_PERSIST = 60 * 60 * 24 * 30;  // 30 days

/** Only bump last_active if the existing value is older than this. */
const TOUCH_THROTTLE_SECONDS = 60;

// ── Row shape ───────────────────────────────────────────────────

export interface SessionRow {
  id:          string;
  user_id:     string;
  created_at:  string;
  last_active: string;
  expires_at:  string;
  revoked_at:  string | null;
  ip:          string | null;
  user_agent:  string | null;
  persist:     boolean;
}

/** What `resolveSession` returns — joined with profile + auth data. */
export interface ResolvedSession {
  sid:       string;
  userId:    string;
  email:     string;
  name:      string;        // profiles.display_name (source of truth)
  role:      string;        // coarse role label
  persist:   boolean;
  expiresAt: string;
}

// ── Create ──────────────────────────────────────────────────────

export async function createSession(args: {
  userId:    string;
  ip:        string | null;
  userAgent: string | null;
  persist:   boolean;
}): Promise<SessionRow> {
  const ttl     = args.persist ? SESSION_MAX_AGE_PERSIST : SESSION_MAX_AGE;
  const expires = new Date(Date.now() + ttl * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("user_sessions")
    .insert({
      user_id:    args.userId,
      expires_at: expires,
      ip:         args.ip,
      user_agent: args.userAgent,
      persist:    args.persist,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create session: ${error?.message}`);
  }
  return data as SessionRow;
}

// ── Resolve ─────────────────────────────────────────────────────
// Looks up a session by id and returns everything `getSession()` callers need.
// Returns null for any failure mode: missing row, revoked, expired, or the
// user record is gone. All failure paths are silent to prevent oracles.

export async function resolveSession(sid: string): Promise<ResolvedSession | null> {
  if (!sid) return null;

  const { data: row, error } = await supabaseAdmin
    .from("user_sessions")
    .select("*")
    .eq("id", sid)
    .maybeSingle();

  if (error || !row) return null;

  const session = row as SessionRow;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  // Profile read — source of truth for display name; joined so callers
  // that need it (shell header, drawer) never see a stale snapshot.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name, username, access_flags")
    .eq("id", session.user_id)
    .maybeSingle();

  // Email + metadata come from auth.users (service-role only).
  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(session.user_id);
  const user = authData?.user;
  if (!user) return null; // user deleted → session dead

  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const p    = profile as { display_name?: string; username?: string; access_flags?: string[] } | null;

  const displayName =
    p?.display_name?.trim() ||
    meta.name?.trim() ||
    p?.username ||
    (user.email ?? "user").split("@")[0];

  const role =
    meta.role
    ?? (p?.access_flags?.includes("Administrator") ? "admin" : "user");

  // Fire-and-forget: bump last_active, but only if it's stale. The WHERE
  // clause is the throttle — concurrent requests all race but at worst
  // do one UPDATE per minute per session. No await: the caller shouldn't
  // block on this.
  touchSession(session.id).catch(() => { /* silent */ });

  return {
    sid:       session.id,
    userId:    session.user_id,
    email:     user.email ?? "",
    name:      displayName,
    role,
    persist:   session.persist,
    expiresAt: session.expires_at,
  };
}

// ── Touch (opportunistic last_active bump) ──────────────────────

async function touchSession(sid: string): Promise<void> {
  const cutoff = new Date(Date.now() - TOUCH_THROTTLE_SECONDS * 1000).toISOString();
  await supabaseAdmin
    .from("user_sessions")
    .update({ last_active: new Date().toISOString() })
    .eq("id", sid)
    .lt("last_active", cutoff);
}

// ── Revoke ──────────────────────────────────────────────────────

export async function revokeSession(sid: string): Promise<void> {
  await supabaseAdmin
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sid)
    .is("revoked_at", null);
}

/** Revoke every active session for this user. Used after a password reset. */
export async function revokeAllForUser(userId: string): Promise<void> {
  await supabaseAdmin
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
}

/** Revoke every active session for this user EXCEPT the one passed in.
 *  Used from /system/profile ("revoke all others") and after an
 *  in-session password change. */
export async function revokeAllOthersForUser(userId: string, keepSid: string): Promise<void> {
  await supabaseAdmin
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .neq("id", keepSid)
    .is("revoked_at", null);
}

// ── List ────────────────────────────────────────────────────────

export async function listSessionsForUser(userId: string): Promise<SessionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("user_sessions")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("last_active", { ascending: false });

  if (error || !data) return [];
  return data as SessionRow[];
}

/** Single-row lookup used by revoke endpoints to verify ownership before acting. */
export async function getSessionRowForUser(
  sid: string,
  userId: string,
): Promise<SessionRow | null> {
  const { data } = await supabaseAdmin
    .from("user_sessions")
    .select("*")
    .eq("id", sid)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}
