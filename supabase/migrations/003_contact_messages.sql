-- =============================================================
-- Zeko OS — Contact Messages Table
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================

create table if not exists public.contact_messages (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  email      text        not null,
  subject    text        not null,
  message    text        not null,
  read       boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Only service role can read/write (all access via server API routes)
create policy "contact_messages: service only"
  on public.contact_messages
  using (false);
