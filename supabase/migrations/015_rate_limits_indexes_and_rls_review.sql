-- =============================================================
-- Zeko OS - Migration 015: Persistent rate limits and hot indexes
--
-- Adds a DB-backed fixed-window rate limiter for Route Handlers and
-- indexes the tables that are repeatedly queried by chat, audit,
-- sessions, inbox, notifications, and presence.
-- =============================================================

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

create or replace function public.hit_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  current_count integer,
  limit_count integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.api_rate_limits%rowtype;
begin
  insert into public.api_rate_limits as rl (
    bucket_key,
    count,
    reset_at,
    created_at,
    updated_at
  )
  values (
    p_bucket_key,
    1,
    v_now + make_interval(secs => p_window_seconds),
    v_now,
    v_now
  )
  on conflict (bucket_key) do update
    set count = case
          when rl.reset_at <= v_now then 1
          else rl.count + 1
        end,
        reset_at = case
          when rl.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds)
          else rl.reset_at
        end,
        updated_at = v_now
  returning * into v_row;

  allowed := v_row.count <= p_limit;
  current_count := v_row.count;
  limit_count := p_limit;
  retry_after_seconds := greatest(1, ceil(extract(epoch from (v_row.reset_at - v_now)))::integer);
  reset_at := v_row.reset_at;
  return next;
end;
$$;

create index if not exists api_rate_limits_reset_at_idx
  on public.api_rate_limits (reset_at);

create index if not exists profiles_status_active_idx
  on public.profiles (session_status, last_active desc);

create index if not exists profiles_username_idx
  on public.profiles (username);

create index if not exists user_roles_user_role_idx
  on public.user_roles (user_id, role_id);

create index if not exists user_roles_role_user_idx
  on public.user_roles (role_id, user_id);

create index if not exists messages_channel_created_idx
  on public.messages (channel_id, created_at);

create index if not exists direct_messages_user_created_idx
  on public.direct_messages (from_user_id, to_user_id, created_at desc);

create index if not exists direct_messages_unread_idx
  on public.direct_messages (to_user_id, read, created_at desc);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_read_idx
  on public.notifications (user_id, read);

create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

create index if not exists contact_messages_read_created_idx
  on public.contact_messages (read, created_at desc);

create index if not exists user_sessions_user_revoked_idx
  on public.user_sessions (user_id, revoked_at, last_active desc);

create index if not exists message_edits_message_time_idx
  on public.message_edits (message_id, edited_at);

-- Best-effort cleanup helper; callers can run this periodically if desired.
create or replace function public.prune_expired_api_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.api_rate_limits
  where reset_at < now() - interval '1 day';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
