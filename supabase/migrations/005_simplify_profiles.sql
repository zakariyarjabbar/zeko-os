-- =============================================================
-- Migration 005 — Simplify profiles table
--
-- Changes:
--   1. display_id  text → integer auto-increment (sequence, starts at 1)
--      Concurrency-safe: PostgreSQL sequences guarantee uniqueness even
--      when two INSERTs race — each call to nextval() is atomic.
--   2. DROP alias, first_name, last_name, department columns
--
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================

-- ── 1. Create the sequence ────────────────────────────────────
create sequence if not exists profiles_display_id_seq start 1;

-- ── 2. Add a staging column that will hold the new integer ids ─
alter table public.profiles add column display_id_new integer;

-- ── 3. Back-fill existing rows with sequential integers ────────
--      Oldest account (by created_at) gets display_id = 1.
update public.profiles p
set display_id_new = sub.rn
from (
  select id, row_number() over (order by created_at asc) as rn
  from public.profiles
) sub
where p.id = sub.id;

-- ── 4. Advance the sequence past the highest assigned value ────
--      So the next INSERT gets the correct next number.
select setval(
  'profiles_display_id_seq',
  coalesce((select max(display_id_new) from public.profiles), 0)
);

-- ── 5. Swap the old text column for the new integer column ─────
alter table public.profiles drop column display_id;
alter table public.profiles rename column display_id_new to display_id;
alter table public.profiles alter column display_id set not null;
alter table public.profiles alter column display_id set default nextval('profiles_display_id_seq');

-- ── 6. Drop deprecated columns ────────────────────────────────
alter table public.profiles drop column if exists alias;
alter table public.profiles drop column if exists first_name;
alter table public.profiles drop column if exists last_name;
alter table public.profiles drop column if exists department;
-- Also clean up other legacy columns from the original seed if present
alter table public.profiles drop column if exists clearance_level;
alter table public.profiles drop column if exists node_assignment;
