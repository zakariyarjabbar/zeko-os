// lib/auth.ts
// Server-side auth helpers — read/write the signed session cookie.
// All functions are server-only (cookies() is a Next.js server API).
//
// SECURITY MODEL (post migration 009)
// ───────────────────────────────────
// The cookie no longer carries user data. It carries only `{ sid }` —
// the primary key of a row in `public.user_sessions`. User identity
// is resolved at read time via lib/sessions.ts → profile + auth.users.
//
// This unlocks:
//   • real multi-session visibility (one row per device)
//   • remote revocation (revoke on phone → cookie on stolen laptop dies)
//   • blast-radius containment on password reset (revokeAllForUser)
//   • no stale display_name in the cookie (it's always looked up fresh)
//
// The cookie is still HMAC-signed so that rotating SESSION_SECRET
// instantly invalidates every outstanding cookie — a fast kill-switch
// that doesn't require touching the DB.
//
// Cookie flags (unchanged):
//   • httpOnly  — not accessible from client-side JavaScript
//   • secure    — transmitted only over HTTPS in production
//   • sameSite  — "lax" to protect against most CSRF vectors
//   • path "/"  — scoped to the entire app
//
// SETUP
// ─────
// Generate a secret:  openssl rand -base64 32
// Add to .env.local:  SESSION_SECRET=<output>

import { cookies } from "next/headers";
import { signPayload, verifyPayload } from "./session-signing";
import {
  createSession,
  resolveSession,
  revokeSession,
} from "./sessions";

const SESSION_COOKIE          = "zk_session";
const SESSION_MAX_AGE         = 60 * 60 * 8;        // 8 hours
const SESSION_MAX_AGE_PERSIST = 60 * 60 * 24 * 30;  // 30 days (remember me)

// ─── Cookie payload ───────────────────────────────────────────
// The ONLY thing in the cookie is the session-row id. Everything else
// (email, name, role) is freshly resolved from the DB on every read.
interface CookiePayload {
  sid: string;
}

// ─── What callers see ─────────────────────────────────────────
// This shape is preserved from the old stateless design so existing
// call-sites don't need to know the storage model changed. `sid` is
// exposed so the Active Sessions UI can identify "this device".
export interface SessionPayload {
  sid:     string;   // session row id (primary key of user_sessions)
  id:      string;   // Supabase auth.users UUID
  email:   string;
  name:    string;   // profiles.display_name (always fresh)
  role:    string;   // coarse role label — use effective flags for authz
  persist: boolean;
}

// ─── Write Session ────────────────────────────────────────────
// Inserts a row into user_sessions, then writes a signed cookie
// whose payload is just the row's id. IP and UA are stored on the
// row so the Active Sessions panel can show them later.
export async function setSession(args: {
  id:         string;                  // Supabase auth user id
  email?:     string;                  // kept for API back-compat; unused here
  name?:      string;                  // kept for API back-compat; unused here
  role?:      string;                  // kept for API back-compat; unused here
  persist?:   boolean;
  ip?:        string | null;
  userAgent?: string | null;
}): Promise<string> {
  const persist = args.persist === true;

  const row = await createSession({
    userId:    args.id,
    ip:        args.ip ?? null,
    userAgent: args.userAgent ?? null,
    persist,
  });

  const signed = await signPayload<CookiePayload>({ sid: row.id });
  const jar    = await cookies();
  jar.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   persist ? SESSION_MAX_AGE_PERSIST : SESSION_MAX_AGE,
  });
  return row.id;
}

// ─── Read Session ─────────────────────────────────────────────
// Verifies the HMAC signature, pulls the session id out, and
// resolves it against the DB. Returns null for any failure —
// missing/malformed/tampered cookie, revoked row, expired row,
// or a user that no longer exists. Silent failure is intentional:
// the auth boundary should never leak why a session is invalid.
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const payload = await verifyPayload<CookiePayload>(raw);
  if (!payload?.sid) return null;

  const resolved = await resolveSession(payload.sid);
  if (!resolved) return null;

  return {
    sid:     resolved.sid,
    id:      resolved.userId,
    email:   resolved.email,
    name:    resolved.name,
    role:    resolved.role,
    persist: resolved.persist,
  };
}

// ─── Clear Session ────────────────────────────────────────────
// Revokes the current session row (so a stolen cookie can't be
// reused after logout) and deletes the cookie. Both operations
// are best-effort — if the cookie is already malformed we still
// want to clear it from the browser.
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;

  if (raw) {
    const payload = await verifyPayload<CookiePayload>(raw);
    if (payload?.sid) {
      try { await revokeSession(payload.sid); } catch { /* silent */ }
    }
  }

  jar.delete(SESSION_COOKIE);
}
