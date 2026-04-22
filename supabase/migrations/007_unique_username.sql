-- =============================================================
-- Zeko OS — Migration 007: Enforce unique usernames
--
-- Changes:
--   1. Add a case-insensitive UNIQUE index on profiles.username so the
--      database rejects duplicates even if the application-layer check
--      loses a race between two concurrent signups.
--
-- Run in Supabase Dashboard → SQL Editor.
-- Before running, resolve any existing collisions:
--   select lower(username), count(*) from public.profiles
--   group by 1 having count(*) > 1;
-- =============================================================

create unique index if not exists profiles_username_ci_unique
  on public.profiles (lower(username));
