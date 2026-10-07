-- =============================================================================
-- 00001_enums_and_users.sql — enums, users table, auth mirror, helpers
--
--   * user_role, activity_type enums
--   * public.users — mirrors auth.users; the app's profile/role store
--   * public.current_user_role() — SECURITY DEFINER helper for RLS policies
--   * handle_new_user() — trigger: creates a public.users row on signup
--   * handle_updated_at() — trigger: maintains updated_at on any table
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('rep', 'manager', 'admin');
create type public.activity_type as enum ('call', 'email', 'meeting', 'note');

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table public.users (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null unique,
  full_name       text not null,
  role            public.user_role not null default 'rep',
  is_active       boolean not null default true,
  avatar_url      text,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.users is
  'Team member profiles. One row per auth.users row (PK = auth.users.id). Role is the single source of truth for RBAC — read per request, never cached in JWT claims.';

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.handle_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at = now().';

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

-- Returns the caller's role from public.users. SECURITY DEFINER so RLS
-- policies can call it without recursive policy checks. STABLE for plan caching.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

comment on function public.current_user_role() is
  'RLS helper: the calling user''s role, or NULL when signed out / no profile row.';

-- Mirror trigger: a new auth.users row gets a public.users row (role = rep).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auth mirror: creates the public.users profile row when a user signs up. Invite flow pre-creates the row via service role so the role is correct from the start.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.users enable row level security;
