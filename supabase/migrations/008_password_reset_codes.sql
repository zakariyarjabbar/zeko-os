-- =============================================================
-- Zeko OS — Migration 008: Password reset via 6-digit OTP
--
-- Two tables:
--   1. password_reset_codes — one row per issued code. Tracks expiry,
--      consumption, attempt counter, and issuing IP/UA for audit.
--      Codes themselves are NEVER stored. We only keep metadata;
--      cryptographic verification is delegated to Supabase's OTP
--      (signInWithOtp + verifyOtp), so a DB dump never leaks codes.
--
--   2. auth_events — append-only audit log. Also the source of truth
--      for cross-code rate limiting (per-email / per-IP counts).
--
-- RLS: neither table is exposed to the client. Only the service role
-- writes/reads these, so RLS is kept off (locked down via key scoping).
-- =============================================================

-- ── Codes ────────────────────────────────────────────────────
create table if not exists public.password_reset_codes (
  id           uuid        primary key default gen_random_uuid(),
  email        text        not null,
  user_id      uuid,                                 -- nullable: don't leak existence at request time
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,                 -- created_at + 2 minutes
  consumed_at  timestamptz,                          -- null = still active
  attempts     int         not null default 0,       -- incremented per /verify try
  ip           text,
  user_agent   text
);

create index if not exists password_reset_codes_email_active_idx
  on public.password_reset_codes (lower(email), created_at desc)
  where consumed_at is null;

create index if not exists password_reset_codes_expires_idx
  on public.password_reset_codes (expires_at);

-- ── Audit / rate-limit events ────────────────────────────────
create table if not exists public.auth_events (
  id          bigserial   primary key,
  kind        text        not null,   -- 'reset_request' | 'reset_verify_ok' | 'reset_verify_fail' | 'reset_verify_rl'
  email       text,
  ip          text,
  success     boolean,
  occurred_at timestamptz not null default now()
);

create index if not exists auth_events_kind_email_time_idx
  on public.auth_events (kind, lower(email), occurred_at desc);

create index if not exists auth_events_kind_ip_time_idx
  on public.auth_events (kind, ip, occurred_at desc);
