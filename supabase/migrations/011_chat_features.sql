-- =============================================================
-- Zeko OS — Migration 011: Chat Features
--
-- Adds:
--   1. typing_indicators — ephemeral "X is typing" state
--   2. edited_at on messages + direct_messages
--   3. REPLICA IDENTITY FULL on those tables (SSE UPDATE needs old row)
--   4. message_edits — immutable audit log of message changes
--   5. notifications — @mention inbox entries
--   6. Realtime publication for new tables
--
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================


-- ── 1. typing_indicators ─────────────────────────────────────
-- Primary-key (user_id, context) enforces one row per user per conversation.
-- context format:
--   channel messages → "channel:<channelId>"
--   direct messages  → "dm:<lower-uuid>:<upper-uuid>"  (UUIDs sorted)

create table if not exists public.typing_indicators (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  context     text        not null,
  handle      text        not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, context)
);

alter table public.typing_indicators enable row level security;

-- Any authenticated user can read the list of who's typing
create policy "typing: authenticated read"
  on public.typing_indicators for select
  using (auth.role() = 'authenticated');

-- Users can only write their own row
create policy "typing: own upsert"
  on public.typing_indicators for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 2. Add edited_at ─────────────────────────────────────────

alter table public.messages
  add column if not exists edited_at timestamptz;

alter table public.direct_messages
  add column if not exists edited_at timestamptz;


-- ── 3. REPLICA IDENTITY FULL ─────────────────────────────────
-- Required so that Supabase Realtime UPDATE payloads include the OLD row values.
-- Without this, payload.old is empty and we cannot detect read-receipt transitions
-- (read: false → true) or confirm which fields changed in an edit.

alter table public.messages         replica identity full;
alter table public.direct_messages  replica identity full;


-- ── 4. message_edits (audit log) ─────────────────────────────
-- Append-only: never update or delete rows here.
-- source distinguishes channel messages from DMs.

create table if not exists public.message_edits (
  id          uuid        default gen_random_uuid() primary key,
  message_id  uuid        not null,
  source      text        not null check (source in ('channel', 'dm')),
  old_body    text        not null,
  new_body    text        not null,
  edited_by   uuid        not null references auth.users(id),
  edited_at   timestamptz not null default now()
);

alter table public.message_edits enable row level security;

-- All authenticated users can read the audit trail.
-- Only service role can insert (edit happens via API, not direct client write).
create policy "edits: authenticated read"
  on public.message_edits for select
  using (auth.role() = 'authenticated');

create index if not exists idx_message_edits_message_id
  on public.message_edits (message_id);


-- ── 5. notifications (@mention inbox) ────────────────────────
-- One row per @mention per recipient.
-- source_id is the originating message UUID.

create table if not exists public.notifications (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  type         text        not null default 'mention',
  source_type  text        not null check (source_type in ('channel', 'dm')),
  source_id    uuid        not null,
  channel_id   text,
  from_user_id uuid        not null references auth.users(id),
  from_handle  text        not null,
  body         text        not null,
  read         boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications: own all"
  on public.notifications for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read)
  where read = false;

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);


-- ── 6. Realtime publications ──────────────────────────────────
-- Add new tables to the supabase_realtime publication so Supabase Realtime
-- can stream INSERT/UPDATE/DELETE events for them.
-- The DO block avoids errors if a table is already enrolled.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'typing_indicators'
  ) then
    alter publication supabase_realtime add table public.typing_indicators;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
