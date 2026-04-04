-- =============================================================
-- Zeko OS — Seed Users
-- Run this AFTER 001 and AFTER creating users via Dashboard.
--
-- Dashboard → Authentication → Users → Add user (×3)
-- Tick "Auto Confirm User" for each:
--   admin@zeko.os     / Admin@1234
--   operator@zeko.os  / Operator@1234
--   dev@zeko.os       / Dev@1234
-- =============================================================

-- ── Admin (root-1) ────────────────────────────────────────────
insert into public.profiles (
  id, display_id, username, first_name, last_name,
  alias, clearance_level, department, node_assignment, access_flags,
  session_status, last_login_ip, last_active
)
select
  u.id,
  'root-1',
  'zeko',
  'Zakariya',
  'Jabbar',
  'zeko',
  'LEVEL-5 / SOVEREIGN',
  'Core Systems',
  'NODE-ALPHA-01',
  array['ROOT_ACCESS', 'SYS_ADMIN', 'BYPASS_SECURITY', 'KEY_ROTATE', 'THREAT_OPS'],
  'ONLINE',
  '192.168.1.104',
  now()
from auth.users u
where u.email = 'admin@zeko.os'
on conflict (id) do update set
  display_id      = excluded.display_id,
  username        = excluded.username,
  first_name      = excluded.first_name,
  last_name       = excluded.last_name,
  alias           = excluded.alias,
  clearance_level = excluded.clearance_level,
  department      = excluded.department,
  node_assignment = excluded.node_assignment,
  access_flags    = excluded.access_flags;


-- ── Operator (operator-1) ─────────────────────────────────────
insert into public.profiles (
  id, display_id, username, first_name, last_name,
  alias, clearance_level, department, node_assignment, access_flags,
  session_status, last_login_ip, last_active
)
select
  u.id,
  'operator-1',
  'n.cross',
  'Nova',
  'Cross',
  'n.cross',
  'LEVEL-3 / ELEVATED',
  'Operations',
  'NODE-BETA-03',
  array['DEPLOY', 'AUDIT', 'MONITOR'],
  'ONLINE',
  '192.168.1.112',
  now()
from auth.users u
where u.email = 'operator@zeko.os'
on conflict (id) do update set
  display_id      = excluded.display_id,
  username        = excluded.username,
  first_name      = excluded.first_name,
  last_name       = excluded.last_name,
  alias           = excluded.alias,
  clearance_level = excluded.clearance_level,
  department      = excluded.department,
  node_assignment = excluded.node_assignment,
  access_flags    = excluded.access_flags;


-- ── Developer (dev-1) ─────────────────────────────────────────
insert into public.profiles (
  id, display_id, username, first_name, last_name,
  alias, clearance_level, department, node_assignment, access_flags,
  session_status, last_login_ip, last_active
)
select
  u.id,
  'dev-1',
  'c.wraight',
  'Cipher',
  'Wraight',
  'c.wraight',
  'LEVEL-2 / STANDARD',
  'Engineering',
  'NODE-DEV-07',
  array['DEPLOY', 'READ_LOGS'],
  'AWAY',
  '192.168.1.99',
  now()
from auth.users u
where u.email = 'dev@zeko.os'
on conflict (id) do update set
  display_id      = excluded.display_id,
  username        = excluded.username,
  first_name      = excluded.first_name,
  last_name       = excluded.last_name,
  alias           = excluded.alias,
  clearance_level = excluded.clearance_level,
  department      = excluded.department,
  node_assignment = excluded.node_assignment,
  access_flags    = excluded.access_flags;


-- ── Verify ────────────────────────────────────────────────────
select u.email, p.display_id, p.username, p.first_name, p.last_name, p.clearance_level
from auth.users u
join public.profiles p on p.id = u.id
where u.email in ('admin@zeko.os', 'operator@zeko.os', 'dev@zeko.os');
