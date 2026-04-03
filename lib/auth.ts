// lib/auth.ts
// Server-side auth helpers — read/write the session cookie.
// All functions are server-only (cookies() is a Next.js server API).

import { cookies } from "next/headers";

const SESSION_COOKIE = "zk_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

// ─── Session Payload ──────────────────────────────────────────
export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

// ─── Write Session ────────────────────────────────────────────
// Called after a successful login. Stores a JSON blob in an
// HTTP-only cookie so no client JS can read it.
export async function setSession(payload: SessionPayload): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

// ─── Read Session ──────────────────────────────────────────────
// Returns the session payload, or null if the cookie is absent
// or malformed.
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Clear Session ────────────────────────────────────────────
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
