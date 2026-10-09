-- =============================================================================
-- 00011_workspace_settings.sql — workspace settings key-value store
--
--   * public.app_settings — workspace-level settings as key/value pairs:
--     workspace name, default currency, stale-deal threshold (days), and the
--     weekly digest toggle. There is no separate workspaces table; a single
--     row per setting key is the whole store.
--   * RLS: every signed-in user can read; only admins can write.
--   * Seeded with the PRD defaults (stale threshold = 14 days).
-- =============================================================================

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is
  'Workspace settings as key/value pairs (workspace name, default currency, stale-deal threshold days, digest enabled). Admin-write, authenticated-read.';

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- seed: PRD defaults
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value)
values
  ('workspace_name',       '"My workspace"'::jsonb),
  ('default_currency',     '"USD"'::jsonb),
  ('stale_threshold_days', '14'::jsonb),
  ('digest_enabled',       'true'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- RLS: admin write, all authenticated read
-- ---------------------------------------------------------------------------
alter table public.app_settings enable row level security;

create policy app_settings_select on public.app_settings
  for select to authenticated
  using (true);

create policy app_settings_write_admin on public.app_settings
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
