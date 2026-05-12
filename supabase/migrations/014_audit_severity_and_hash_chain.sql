-- =============================================================
-- Zeko OS - Migration 014: Audit severity and hash chaining
--
-- Adds event severity for triage and a lightweight hash chain so
-- administrators can detect audit row tampering or gaps.
-- =============================================================

alter table public.security_audit_events
  add column if not exists severity text not null default 'info',
  add column if not exists previous_hash text,
  add column if not exists event_hash text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'security_audit_events_severity_check'
  ) then
    alter table public.security_audit_events
      add constraint security_audit_events_severity_check
      check (severity in ('info', 'low', 'medium', 'high', 'critical'));
  end if;
end $$;

create index if not exists security_audit_events_severity_time_idx
  on public.security_audit_events (severity, occurred_at desc);

create index if not exists security_audit_events_actor_time_idx
  on public.security_audit_events (actor_user_id, occurred_at desc);

create index if not exists security_audit_events_target_time_idx
  on public.security_audit_events (target_id, occurred_at desc);
