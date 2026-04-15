-- =============================================================
-- Zeko OS — Migration 006: Security Hardening
--
-- Changes:
--   1. Add display_name column to profiles (if absent)
--   2. Fix messages RLS: block regular users from forging system messages
--   3. Add CHECK constraints on messages.body (length + not empty)
--   4. Add CHECK constraints on direct_messages.body
--   5. Add performance + security indexes on direct_messages
--   6. Restrict contact_messages INSERT to service role
--
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================


-- ── 1. Add display_name to profiles ──────────────────────────
-- Required by the profile builder but was never added to the initial schema.
-- DEFAULT '' so existing rows are backfilled automatically.

alter table public.profiles
  add column if not exists display_name text not null default '';


-- ── 2. Fix messages INSERT RLS ────────────────────────────────
-- The original policy allowed any authenticated user to insert a row with
-- type = 'system'.  System messages should only ever come from the server
-- (service role bypasses RLS entirely), so regular users must not be able
-- to fake them.

drop policy if exists "messages: own insert" on public.messages;

create policy "messages: own insert"
  on public.messages for insert
  with check (
    auth.uid() = user_id
    and type = 'message'   -- only 'message' type; service role handles 'system'
  );


-- ── 3. messages.body constraints ─────────────────────────────
-- Enforce the same 4 000-char cap at the DB level, so a compromised API
-- route or direct DB write cannot bypass the application-layer Zod check.
-- Also prevents empty bodies from being stored.

alter table public.messages
  add constraint messages_body_not_empty
    check (length(trim(body)) > 0),
  add constraint messages_body_max_length
    check (length(body) <= 4000);


-- ── 4. direct_messages.body constraints ──────────────────────

alter table public.direct_messages
  add constraint dm_body_not_empty
    check (length(trim(body)) > 0),
  add constraint dm_body_max_length
    check (length(body) <= 4000);


-- ── 5. direct_messages indexes ───────────────────────────────
-- The DM conversation list queries by from_user_id and to_user_id in both
-- directions.  Without an index every query is a sequential scan.

-- Per-user inbox (outbox and inbox queries)
create index if not exists dm_from_user_created
  on public.direct_messages (from_user_id, created_at asc);

create index if not exists dm_to_user_created
  on public.direct_messages (to_user_id, created_at asc);

-- Conversation thread lookup (both participants, ordered by time)
-- Uses least/greatest to canonicalise the pair so one index covers both directions.
create index if not exists dm_conversation_thread
  on public.direct_messages (
    least(from_user_id::text, to_user_id::text),
    greatest(from_user_id::text, to_user_id::text),
    created_at asc
  );

-- Unread count query (to_user_id + read flag)
create index if not exists dm_unread_for_user
  on public.direct_messages (to_user_id, read)
  where read = false;


-- ── 6. contact_messages: block direct client INSERT ──────────
-- The existing RLS policy (using (false)) blocks SELECT/UPDATE/DELETE for
-- anon and authenticated roles, but there was no explicit INSERT restriction.
-- Service role is always exempt from RLS, so this only blocks client-side writes.

drop policy if exists "contact_messages: service only" on public.contact_messages;

create policy "contact_messages: no direct client access"
  on public.contact_messages
  using (false)
  with check (false);
