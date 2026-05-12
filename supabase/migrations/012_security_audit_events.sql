-- =============================================================
-- Zeko OS — Migration 012: Security audit events
--
-- Append-only audit log for privileged and security-sensitive
-- actions. This is separate from auth_events, which doubles as the
-- rate-limit counter source for login/signup/reset flows.
--
-- RLS is enabled with no client policies. The server writes through
-- the Supabase service role, which bypasses RLS.
-- =============================================================

create table if not exists public.security_audit_events (
  id               bigserial   primary key,
  actor_user_id    uuid        references auth.users(id) on delete set null,
  actor_session_id uuid,
  action           text        not null,
  target_type      text        not null,
  target_id        text,
  metadata         jsonb       not null default '{}'::jsonb,
  ip               text,
  user_agent       text,
  request_id       text,
  occurred_at      timestamptz not null default now()
);

alter table public.security_audit_events enable row level security;

revoke all on public.security_audit_events from anon, authenticated;
revoke all on sequence public.security_audit_events_id_seq from anon, authenticated;

create index if not exists security_audit_events_actor_time_idx
  on public.security_audit_events (actor_user_id, occurred_at desc);

create index if not exists security_audit_events_action_time_idx
  on public.security_audit_events (action, occurred_at desc);

create index if not exists security_audit_events_target_time_idx
  on public.security_audit_events (target_type, target_id, occurred_at desc);

