// lib/auth.ts
// Server-side auth helpers — read/write the signed session cookie.
// All functions are server-only (cookies() is a Next.js server API).
//
// SECURITY
// ────────
// The cookie value is HMAC-SHA-256 signed by SESSION_SECRET (see
// lib/session-signing.ts). A tampered or forged cookie fails verification
// and is treated as "no session", forcing a fresh login.
// The cookie is:
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

const SESSION_COOKIE          = "zk_session";
const SESSION_MAX_AGE         = 60 * 60 * 8;        // 8 hours  (default)
const SESSION_MAX_AGE_PERSIST = 60 * 60 * 24 * 30;  // 30 days  (remember me)

// ─── Session Payload ──────────────────────────────────────────
// `persist` is stored on the payload so subsequent reissues (e.g. profile
// edits that rewrite the cookie) preserve the original lifetime intent.
export interface SessionPayload {
  id:       string;   // Supabase auth.users UUID
  email:    string;
  name:     string;   // display name (kept in sync with profiles.display_name)
  role:     string;   // coarse role label — use effective flags for authorisation
  persist?: boolean;  // true → long-lived "remember me" cookie
}

// ─── Write Session ────────────────────────────────────────────
// Signs the payload with HMAC-SHA-256 before writing so tampering
// is detectable at read time.
export async function setSession(payload: SessionPayload): Promise<void> {
  const jar    = await cookies();
  const signed = await signPayload(payload);
  jar.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   payload.persist ? SESSION_MAX_AGE_PERSIST : SESSION_MAX_AGE,
  });
}

// ─── Read Session ──────────────────────────────────────────────
// Verifies the HMAC signature before deserialising.
// Returns null if the cookie is absent, malformed, or tampered with.
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifyPayload<SessionPayload>(raw);
}

// ─── Clear Session ────────────────────────────────────────────
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
