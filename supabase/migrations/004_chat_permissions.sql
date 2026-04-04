-- =============================================================
-- Zeko OS — Chat Channel Permissions
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================

-- Insert channel-scoped permissions into the permissions table
insert into public.permissions (name, description) values
  ('view:global-ops',         'View messages in #global-ops'),
  ('delete-msg:global-ops',   'Delete messages in #global-ops'),
  ('view:system-logs',        'View messages in #system-logs'),
  ('delete-msg:system-logs',  'Delete messages in #system-logs'),
  ('view:deployment',         'View messages in #deployment'),
  ('delete-msg:deployment',   'Delete messages in #deployment'),
  ('view:security-alerts',    'View messages in #security-alerts'),
  ('delete-msg:security-alerts', 'Delete messages in #security-alerts')
on conflict (name) do nothing;

-- Map these to the channel_permissions table
-- (so the API knows which permission key governs which channel action)
insert into public.channel_permissions (channel_id, permission) values
  ('global-ops',      'view:global-ops'),
  ('global-ops',      'delete-msg:global-ops'),
  ('system-logs',     'view:system-logs'),
  ('system-logs',     'delete-msg:system-logs'),
  ('deployment',      'view:deployment'),
  ('deployment',      'delete-msg:deployment'),
  ('security-alerts', 'view:security-alerts'),
  ('security-alerts', 'delete-msg:security-alerts')
on conflict do nothing;

-- Remove old generic permissions that were seeded before
delete from public.channel_permissions
where permission in ('view_channel', 'send_message', 'delete_message');
