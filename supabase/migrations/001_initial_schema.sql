-- =============================================================
-- Zeko OS — Initial Schema
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================

-- ─── Profiles ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid        primary key references auth.users(id) on delete cascade,

  -- Display identity
  display_id       text        not null default 'user-0',  -- e.g. root-1, operator-2
  username         text        not null default 'unknown',
  first_name       text        not null default '',
  last_name        text        not null default '',

  -- Clearance / org
  alias            text        not null default 'unknown',
  clearance_level  text        not null default 'LEVEL-1 / RESTRICTED',
  department       text        not null default 'Unassigned',
  node_assignment  text        not null default 'NODE-UNKNOWN',
  access_flags     text[]      not null default '{"READ_LOGS"}',

  -- Session tracking
  session_status   text        not null default 'OFFLINE' check (session_status in ('ONLINE','AWAY','OFFLINE')),
  last_login_ip    text        not null default '0.0.0.0',
  last_active      timestamptz not null default now(),

  created_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles: service insert"
  on public.profiles for insert
  with check (true);


-- ─── Channels ─────────────────────────────────────────────────
create table if not exists public.channels (
  id           text        primary key,
  label        text        not null,
  topic        text        not null default '',
  member_count int         not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.channels enable row level security;

create policy "channels: authenticated read"
  on public.channels for select
  using (auth.role() = 'authenticated');


-- ─── Messages ─────────────────────────────────────────────────
create table if not exists public.messages (
  id          uuid        primary key default gen_random_uuid(),
  channel_id  text        not null references public.channels(id) on delete cascade,
  user_id     uuid        references auth.users(id) on delete set null,
  user_handle text        not null,
  body        text        not null,
  type        text        not null default 'message' check (type in ('message', 'system')),
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "messages: authenticated read"
  on public.messages for select
  using (auth.role() = 'authenticated');

create policy "messages: own insert"
  on public.messages for insert
  with check (auth.uid() = user_id or type = 'system');

create index if not exists messages_channel_created
  on public.messages (channel_id, created_at asc);


-- ─── Seed: Channels ───────────────────────────────────────────
insert into public.channels (id, label, topic, member_count) values
  ('global-ops',      '#global-ops',      'encrypted channel · 4 online',   4),
  ('system-logs',     '#system-logs',     'system event stream · 2 online',  2),
  ('deployment',      '#deployment',      'deployment pipeline · 3 online',  3),
  ('security-alerts', '#security-alerts', 'threat monitoring · 2 online',    2)
on conflict (id) do nothing;
