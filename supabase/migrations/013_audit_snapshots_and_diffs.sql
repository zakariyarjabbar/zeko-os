-- =============================================================
-- Zeko OS — Migration 013: Audit snapshots and diffs
--
-- security_audit_events remains ID-first, but these columns preserve
-- event-time labels and before/after summaries for investigations.
-- The UI can show both "current" linked names and "at event time"
-- snapshots without changing the immutable actor/target ids.
-- =============================================================

alter table public.security_audit_events
  add column if not exists actor_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists target_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists diff jsonb not null default '{}'::jsonb;

