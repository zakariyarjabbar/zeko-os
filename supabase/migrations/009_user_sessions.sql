-- =============================================================
-- Zeko OS — Migration 009: DB-backed user sessions
--
-- Moves session state from a single opaque cookie to a row per
-- session, so a user can see every signed-in device and revoke
-- any of them from /system/profile. Unlocks real security posture:
--   • visibility of concurrent sessions (IP + UA + timestamps)
--   • remote revocation (stolen laptop, shared kiosk, etc.)
--   • server-side session expiry (not just cookie expiry)
--   • automatic blast-radius containment on password reset
--     (we revoke all prior sessions before minting a new one)
--
-- The cookie still carries an HMAC-signed payload; the payload is
-- now just `{ sid }` — the primary key of a row in this table. The
-- HMAC signature is retained so secret rotation instantly
-- invalidates every outstanding cookie without a DB change.
--
-- RLS: not exposed to the client. Only the service role touches
-- this table, so RLS is left off (same pattern as password_reset_codes
-- and auth_events in migration 008).
-- =============================================================

create table if not exists public.user_sessions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_active timestamptz not null default now(),
  expires_at  timestamptz not null,                -- matches the cookie's Max-Age
  revoked_at  timestamptz,                         -- null = still valid
  ip          text,
  user_agent  text,
  persist     boolean     not null default false   -- true = "remember me" (30 days)
);

-- Fast "list active sessions for user X": covers the profile panel
-- and the "revoke all others" path.
create index if not exists user_sessions_user_active_idx
  on public.user_sessions (user_id, created_at desc)
  where revoked_at is null;

-- Fast expiry sweep (future cron job; also used on read to skip
-- expired rows without a full scan).
create index if not exists user_sessions_expires_idx
  on public.user_sessions (expires_at)
  where revoked_at is null;
