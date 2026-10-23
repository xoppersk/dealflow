-- =============================================================================
-- 00012_workspaces.sql — per-account workspaces (multi-tenancy) for Dealflow v2
--
-- Production-readiness workstream W1 (DB). IDEMPOTENT: safe to re-run.
--
--   a. workspaces table (+ updated_at trigger)
--   b. workspace_members table (workspace x user, role, is_owner)
--   c. SECURITY DEFINER helpers: current_workspace_ids(), workspace_role(ws)
--   d. workspace_id on all 11 scoped v1 tables (FK + index per table);
--      app_settings PK becomes (workspace_id, key)
--   e. Legacy backfill: Sheku's "Sevyn Labs" workspace owns all existing rows
--   f. pipeline_stages: slug / requires / stale_limit_days; per-workspace
--      uniques; legacy 6 stages normalized to the v2 canon (data/stages.json)
--   g. Column additions: deals next_step_*, composition; contacts prefers,
--      met_through; companies size_label, city; activities type_label
--   h. RLS rewrite: tenancy policies on all 14 tables (membership-based)
--   i. Provisioning: handle_new_user() also creates personal workspace +
--      owner membership + 6 starter stages; RPC ensure_workspace()
--   j. Grants: anon loses all table grants; authenticated ensured
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- a. workspaces
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  scope                    text,
  owner_id                 uuid not null references auth.users (id),
  stale_limit_days         integer not null default 21,
  stale_limit_pending_days integer not null default 14,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.workspaces is
  'Per-account tenancy root (v2). Every scoped row belongs to exactly one workspace; access is by workspace_members membership.';

drop trigger if exists workspaces_updated_at on public.workspaces;
create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- b. workspace_members
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  role         public.user_role not null default 'rep',
  is_owner     boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Workspace membership + per-workspace role. The tenancy authority for RLS (replaces v1 global-role reads on scoped tables).';

-- ---------------------------------------------------------------------------
-- c. Tenancy helpers (SECURITY DEFINER so RLS policies never recurse)
-- ---------------------------------------------------------------------------
create or replace function public.current_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
    from public.workspace_members wm
   where wm.user_id = auth.uid();
$$;

comment on function public.current_workspace_ids() is
  'RLS helper: ids of every workspace the caller is a member of (empty when signed out).';

create or replace function public.workspace_role(ws uuid)
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
    from public.workspace_members wm
   where wm.workspace_id = ws
     and wm.user_id = auth.uid();
$$;

comment on function public.workspace_role(uuid) is
  'RLS helper: the caller''s role in workspace ws, or NULL when not a member.';

-- ---------------------------------------------------------------------------
-- d/g. New columns (all idempotent)
-- ---------------------------------------------------------------------------
-- workspace_id on the 11 scoped tables (nullable until backfill in §e)
alter table public.pipeline_stages  add column if not exists workspace_id uuid;
alter table public.companies        add column if not exists workspace_id uuid;
alter table public.contacts         add column if not exists workspace_id uuid;
alter table public.deals            add column if not exists workspace_id uuid;
alter table public.deal_contacts    add column if not exists workspace_id uuid;
alter table public.activities       add column if not exists workspace_id uuid;
alter table public.stage_history    add column if not exists workspace_id uuid;
alter table public.audit_log        add column if not exists workspace_id uuid;
alter table public.deal_attachments add column if not exists workspace_id uuid;
alter table public.invites          add column if not exists workspace_id uuid;
alter table public.app_settings     add column if not exists workspace_id uuid;

-- f. pipeline_stages v2 columns
alter table public.pipeline_stages add column if not exists slug text;
alter table public.pipeline_stages add column if not exists requires jsonb not null default '[]'::jsonb;
alter table public.pipeline_stages add column if not exists stale_limit_days integer not null default 14;

-- g. deals / contacts / companies / activities additions
-- (verified against live information_schema: contacts.phone, companies.industry
--  and companies.website already exist; only the columns below were missing)
alter table public.deals     add column if not exists next_step_text text;
alter table public.deals     add column if not exists next_step_due date;
alter table public.deals     add column if not exists composition jsonb not null default '[]'::jsonb;
alter table public.contacts  add column if not exists prefers text;
alter table public.contacts  add column if not exists met_through text;
alter table public.companies add column if not exists size_label text;
alter table public.companies add column if not exists city text;
alter table public.activities add column if not exists type_label text;

-- d. workspace FK + index per scoped table
do $$
declare t text;
begin
  foreach t in array array[
    'pipeline_stages','companies','contacts','deals','deal_contacts',
    'activities','stage_history','audit_log','deal_attachments','invites',
    'app_settings'
  ] loop
    if not exists (
      select 1 from pg_constraint
       where conname = t || '_workspace_id_fkey'
         and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (workspace_id) references public.workspaces (id)',
        t, t || '_workspace_id_fkey'
      );
    end if;
    execute format(
      'create index if not exists %I on public.%I (workspace_id)',
      t || '_workspace_idx', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- e. Legacy backfill — Sheku's workspace owns every pre-tenancy row
-- ---------------------------------------------------------------------------
do $$
declare
  v_owner uuid;
  v_ws    uuid;
begin
  select id into v_owner from auth.users where email = 'xoppersk@gmail.com';
  if v_owner is null then
    raise notice '00012: legacy owner xoppersk@gmail.com not found — skipping legacy backfill';
    return;
  end if;

  select id into v_ws
    from public.workspaces
   where owner_id = v_owner
   order by created_at asc
   limit 1;

  if v_ws is null then
    insert into public.workspaces (name, scope, owner_id)
    values ('Sevyn Labs', 'Sales', v_owner)
    returning id into v_ws;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, is_owner)
  values (v_ws, v_owner, 'admin', true)
  on conflict (workspace_id, user_id) do nothing;

  update public.pipeline_stages  set workspace_id = v_ws where workspace_id is null;
  update public.companies        set workspace_id = v_ws where workspace_id is null;
  update public.contacts         set workspace_id = v_ws where workspace_id is null;
  update public.deals            set workspace_id = v_ws where workspace_id is null;
  update public.activities       set workspace_id = v_ws where workspace_id is null;
  update public.stage_history    set workspace_id = v_ws where workspace_id is null;
  update public.audit_log        set workspace_id = v_ws where workspace_id is null;
  update public.deal_attachments set workspace_id = v_ws where workspace_id is null;
  update public.invites          set workspace_id = v_ws where workspace_id is null;
  update public.app_settings     set workspace_id = v_ws where workspace_id is null;

  -- deal_contacts inherits from its deal (fallback: the legacy workspace)
  update public.deal_contacts dc
     set workspace_id = d.workspace_id
    from public.deals d
   where dc.deal_id = d.id
     and dc.workspace_id is null
     and d.workspace_id is not null;
  update public.deal_contacts set workspace_id = v_ws where workspace_id is null;
end $$;

-- d. app_settings: PK (key) -> PK (workspace_id, key)
do $$
declare
  v_pk_name text;
  v_pk_cols text;
begin
  select c.conname,
         string_agg(a.attname, ',' order by array_position(c.conkey, a.attnum))
    into v_pk_name, v_pk_cols
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'public.app_settings'::regclass
     and c.contype = 'p'
   group by c.conname;

  if v_pk_cols is distinct from 'workspace_id,key' then
    if v_pk_name is not null then
      execute format('alter table public.app_settings drop constraint %I', v_pk_name);
    end if;
    alter table public.app_settings add primary key (workspace_id, key);
  end if;
end $$;

-- e. workspace_id NOT NULL everywhere (provisioning guarantees a workspace
--    exists before any app write, so no legitimate row can lack one)
do $$
declare t text;
begin
  foreach t in array array[
    'pipeline_stages','companies','contacts','deals','deal_contacts',
    'activities','stage_history','audit_log','deal_attachments','invites',
    'app_settings'
  ] loop
    execute format('alter table public.%I alter column workspace_id set not null', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- f. pipeline_stages — per-workspace uniques + legacy normalization
-- ---------------------------------------------------------------------------
alter table public.pipeline_stages drop constraint if exists pipeline_stages_position_key;
drop index if exists public.pipeline_stages_single_won;
drop index if exists public.pipeline_stages_single_lost;

create unique index if not exists pipeline_stages_ws_position_uniq
  on public.pipeline_stages (workspace_id, position);
create unique index if not exists pipeline_stages_ws_slug_uniq
  on public.pipeline_stages (workspace_id, slug);
create unique index if not exists pipeline_stages_ws_single_won
  on public.pipeline_stages (workspace_id) where is_closed_won;
create unique index if not exists pipeline_stages_ws_single_lost
  on public.pipeline_stages (workspace_id) where is_closed_lost;

-- Normalize Sheku's 6 legacy stages to the v2 canon (data/stages.json).
-- Matched by position inside the legacy workspace only — other workspaces'
-- stages are never touched, so this stays correct on re-runs.
do $$
declare
  v_owner uuid;
  v_ws    uuid;
begin
  select id into v_owner from auth.users where email = 'xoppersk@gmail.com';
  if v_owner is null then return; end if;
  select id into v_ws from public.workspaces
   where owner_id = v_owner order by created_at asc limit 1;
  if v_ws is null then return; end if;

  update public.pipeline_stages
     set name = 'New lead', slug = 'new-lead', default_probability = 18,
         requires = '["Company, owner"]'::jsonb, stale_limit_days = 21
   where workspace_id = v_ws and position = 0;
  update public.pipeline_stages
     set name = 'Discovery', slug = 'discovery', default_probability = 24,
         requires = '["A contact and a first meeting"]'::jsonb, stale_limit_days = 14
   where workspace_id = v_ws and position = 1;
  update public.pipeline_stages
     set name = 'Proposal', slug = 'proposal', default_probability = 35,
         requires = '["Value and expected close date"]'::jsonb, stale_limit_days = 10
   where workspace_id = v_ws and position = 2;
  update public.pipeline_stages
     set name = 'Negotiation', slug = 'negotiation', default_probability = 39,
         requires = '["Decision maker named"]'::jsonb, stale_limit_days = 10
   where workspace_id = v_ws and position = 3;
  update public.pipeline_stages
     set name = 'Won', slug = 'won', default_probability = 100,
         requires = '["Signed date and final value"]'::jsonb, stale_limit_days = 14
   where workspace_id = v_ws and position = 4;
  update public.pipeline_stages
     set name = 'Lost', slug = 'lost', default_probability = 0,
         requires = '["A reason from the list"]'::jsonb, stale_limit_days = 14
   where workspace_id = v_ws and position = 5;
end $$;

-- ---------------------------------------------------------------------------
-- i. Provisioning — one idempotent routine used by the auth trigger AND
--    the ensure_workspace() RPC (pre-migration users, belt-and-braces)
-- ---------------------------------------------------------------------------
create or replace function public.provision_user_workspace(
  p_user_id   uuid,
  p_email     text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws      uuid;
  v_display text := coalesce(
    nullif(p_full_name, ''),
    split_part(coalesce(p_email, ''), '@', 1)
  );
begin
  -- users mirror row (the v1 handle_new_user behaviour, preserved)
  insert into public.users (id, email, full_name)
  values (p_user_id, p_email, v_display)
  on conflict (id) do nothing;

  -- already provisioned? return the caller's first workspace
  select wm.workspace_id into v_ws
    from public.workspace_members wm
   where wm.user_id = p_user_id
   order by wm.created_at asc
   limit 1;
  if v_ws is not null then
    return v_ws;
  end if;

  insert into public.workspaces (name, owner_id)
  values (v_display || '''s workspace', p_user_id)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role, is_owner)
  values (v_ws, p_user_id, 'admin', true)
  on conflict (workspace_id, user_id) do nothing;

  -- 6 starter stages, v2 canon (data/stages.json)
  insert into public.pipeline_stages
    (workspace_id, name, slug, position, color, is_closed_won, is_closed_lost,
     default_probability, requires, stale_limit_days)
  values
    (v_ws, 'New lead',    'new-lead',    0, '#0F766E', false, false,  18, '["Company, owner"]'::jsonb,               21),
    (v_ws, 'Discovery',   'discovery',   1, '#2563EB', false, false,  24, '["A contact and a first meeting"]'::jsonb, 14),
    (v_ws, 'Proposal',    'proposal',    2, '#7C3AED', false, false,  35, '["Value and expected close date"]'::jsonb, 10),
    (v_ws, 'Negotiation', 'negotiation', 3, '#D97706', false, false,  39, '["Decision maker named"]'::jsonb,          10),
    (v_ws, 'Won',         'won',         4, '#15803D', true,  false, 100, '["Signed date and final value"]'::jsonb,   14),
    (v_ws, 'Lost',        'lost',        5, '#78716C', false, true,    0, '["A reason from the list"]'::jsonb,        14)
  on conflict (workspace_id, slug) do nothing;

  return v_ws;
end;
$$;

comment on function public.provision_user_workspace(uuid, text, text) is
  'Idempotent signup provisioning: users row + personal workspace + owner membership (admin) + 6 starter stages. Used by handle_new_user() and ensure_workspace().';

-- Replace handle_new_user(): users row (as before) + full provisioning.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_user_workspace(
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auth trigger: mirrors the user into public.users AND provisions a personal workspace with starter stages (00012).';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- App-side belt-and-braces for users who predate provisioning.
create or replace function public.ensure_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_name  text;
begin
  if v_uid is null then
    raise exception 'DEALFLOW_ENSURE_WORKSPACE: not authenticated';
  end if;
  select email, raw_user_meta_data ->> 'full_name'
    into v_email, v_name
    from auth.users
   where id = v_uid;
  return public.provision_user_workspace(v_uid, v_email, v_name);
end;
$$;

comment on function public.ensure_workspace() is
  'Returns the caller''s first workspace id, provisioning exactly as the signup trigger does when the caller has none.';

grant execute on function public.current_workspace_ids() to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.ensure_workspace() to authenticated;
revoke execute on function public.provision_user_workspace(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- h. RLS rewrite — tenancy policies
-- ---------------------------------------------------------------------------
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;

-- Drop ALL existing policies on the 12 v1 tables (rewritten below).
do $$
declare p record;
begin
  for p in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'users','pipeline_stages','companies','contacts','deals',
         'deal_contacts','activities','stage_history','audit_log',
         'deal_attachments','invites','app_settings'
       )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- New tables: drop any prior copies so re-runs converge.
drop policy if exists ws_select on public.workspaces;
drop policy if exists ws_insert on public.workspaces;
drop policy if exists ws_update on public.workspaces;
drop policy if exists ws_delete on public.workspaces;
drop policy if exists wm_select on public.workspace_members;
drop policy if exists wm_insert on public.workspace_members;
drop policy if exists wm_update on public.workspace_members;
drop policy if exists wm_delete on public.workspace_members;

-- workspaces: members read; admins update; owner+admin delete; a user may
-- create a workspace they own (provisioning itself runs as definer).
create policy ws_select on public.workspaces
  for select to authenticated
  using (id in (select public.current_workspace_ids()));

create policy ws_insert on public.workspaces
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy ws_update on public.workspaces
  for update to authenticated
  using (public.workspace_role(id) = 'admin')
  with check (public.workspace_role(id) = 'admin');

create policy ws_delete on public.workspaces
  for delete to authenticated
  using (owner_id = auth.uid() and public.workspace_role(id) = 'admin');

-- workspace_members: members read the roster; workspace admins manage it.
create policy wm_select on public.workspace_members
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

create policy wm_insert on public.workspace_members
  for insert to authenticated
  with check (public.workspace_role(workspace_id) = 'admin');

create policy wm_update on public.workspace_members
  for update to authenticated
  using (public.workspace_role(workspace_id) = 'admin')
  with check (public.workspace_role(workspace_id) = 'admin');

create policy wm_delete on public.workspace_members
  for delete to authenticated
  using (public.workspace_role(workspace_id) = 'admin');

-- Scoped tables: full CRUD for members of the row's workspace.
-- (deals soft-delete is an UPDATE of deleted_at — covered by ws_update.)
create policy companies_ws_select on public.companies
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy companies_ws_insert on public.companies
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));
create policy companies_ws_update on public.companies
  for update to authenticated
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
create policy companies_ws_delete on public.companies
  for delete to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

create policy contacts_ws_select on public.contacts
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy contacts_ws_insert on public.contacts
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));
create policy contacts_ws_update on public.contacts
  for update to authenticated
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
create policy contacts_ws_delete on public.contacts
  for delete to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

create policy deals_ws_select on public.deals
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy deals_ws_insert on public.deals
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));
create policy deals_ws_update on public.deals
  for update to authenticated
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
create policy deals_ws_delete on public.deals
  for delete to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

create policy deal_contacts_ws_select on public.deal_contacts
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy deal_contacts_ws_insert on public.deal_contacts
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));
create policy deal_contacts_ws_update on public.deal_contacts
  for update to authenticated
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
create policy deal_contacts_ws_delete on public.deal_contacts
  for delete to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

create policy activities_ws_select on public.activities
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy activities_ws_insert on public.activities
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));
create policy activities_ws_update on public.activities
  for update to authenticated
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
create policy activities_ws_delete on public.activities
  for delete to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

create policy stage_history_ws_select on public.stage_history
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy stage_history_ws_insert on public.stage_history
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));
create policy stage_history_ws_update on public.stage_history
  for update to authenticated
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
create policy stage_history_ws_delete on public.stage_history
  for delete to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

create policy deal_attachments_ws_select on public.deal_attachments
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy deal_attachments_ws_insert on public.deal_attachments
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));
create policy deal_attachments_ws_update on public.deal_attachments
  for update to authenticated
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
create policy deal_attachments_ws_delete on public.deal_attachments
  for delete to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

create policy invites_ws_select on public.invites
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy invites_ws_insert on public.invites
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));
create policy invites_ws_update on public.invites
  for update to authenticated
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
create policy invites_ws_delete on public.invites
  for delete to authenticated
  using (workspace_id in (select public.current_workspace_ids()));

-- pipeline_stages + app_settings: members read; workspace admins write.
create policy stages_ws_select on public.pipeline_stages
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy stages_admin_insert on public.pipeline_stages
  for insert to authenticated
  with check (public.workspace_role(workspace_id) = 'admin');
create policy stages_admin_update on public.pipeline_stages
  for update to authenticated
  using (public.workspace_role(workspace_id) = 'admin')
  with check (public.workspace_role(workspace_id) = 'admin');
create policy stages_admin_delete on public.pipeline_stages
  for delete to authenticated
  using (public.workspace_role(workspace_id) = 'admin');

create policy settings_ws_select on public.app_settings
  for select to authenticated
  using (workspace_id in (select public.current_workspace_ids()));
create policy settings_admin_insert on public.app_settings
  for insert to authenticated
  with check (public.workspace_role(workspace_id) = 'admin');
create policy settings_admin_update on public.app_settings
  for update to authenticated
  using (public.workspace_role(workspace_id) = 'admin')
  with check (public.workspace_role(workspace_id) = 'admin');
create policy settings_admin_delete on public.app_settings
  for delete to authenticated
  using (public.workspace_role(workspace_id) = 'admin');

-- audit_log: workspace admins read; members append own-workspace rows;
-- NO update/delete policies — append-only.
create policy audit_admin_select on public.audit_log
  for select to authenticated
  using (public.workspace_role(workspace_id) = 'admin');
create policy audit_ws_insert on public.audit_log
  for insert to authenticated
  with check (workspace_id in (select public.current_workspace_ids()));

-- users: own row, or rows sharing a workspace membership; update own only.
-- (The role/is_active privilege-guard trigger from 00007 still applies.)
create policy users_ws_select on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
        from public.workspace_members wm
       where wm.user_id = public.users.id
         and wm.workspace_id in (select public.current_workspace_ids())
    )
  );
create policy users_ws_update on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- j. Grants — anon gets NO table privileges; authenticated ensured.
-- (service_role bypasses RLS and keeps its default full grants.)
-- ---------------------------------------------------------------------------
revoke all on public.workspaces        from anon;
revoke all on public.workspace_members from anon;
revoke all on public.users             from anon;
revoke all on public.pipeline_stages   from anon;
revoke all on public.companies         from anon;
revoke all on public.contacts          from anon;
revoke all on public.deals             from anon;
revoke all on public.deal_contacts     from anon;
revoke all on public.activities        from anon;
revoke all on public.stage_history     from anon;
revoke all on public.audit_log         from anon;
revoke all on public.deal_attachments  from anon;
revoke all on public.invites           from anon;
revoke all on public.app_settings      from anon;

grant select, insert, update, delete on public.workspaces        to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.users             to authenticated;
grant select, insert, update, delete on public.pipeline_stages   to authenticated;
grant select, insert, update, delete on public.companies         to authenticated;
grant select, insert, update, delete on public.contacts          to authenticated;
grant select, insert, update, delete on public.deals             to authenticated;
grant select, insert, update, delete on public.deal_contacts     to authenticated;
grant select, insert, update, delete on public.activities        to authenticated;
grant select, insert, update, delete on public.stage_history     to authenticated;
grant select, insert, update, delete on public.audit_log         to authenticated;
grant select, insert, update, delete on public.deal_attachments  to authenticated;
grant select, insert, update, delete on public.invites           to authenticated;
grant select, insert, update, delete on public.app_settings      to authenticated;
