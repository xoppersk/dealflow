-- =============================================================================
-- 00003_companies_contacts.sql — companies and contacts (+ full-text search)
--
--   * public.companies — customer/prospect organizations
--   * public.contacts  — people; email is the deduplication key
--   * search_vector maintained by trigger, GIN-indexed for <500ms typeahead
-- =============================================================================

create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  industry   text,
  website    text,
  size       text,
  owner_id   uuid references public.users (id) on delete set null,
  created_by uuid not null references public.users (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is
  'Customer/prospect organizations. Soft-deleted via deleted_at (hidden from all lists, recoverable by admin).';

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.handle_updated_at();

create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  email       text,
  phone       text,
  title       text,
  company_id  uuid references public.companies (id) on delete set null,
  owner_id    uuid references public.users (id) on delete set null,
  created_by  uuid not null references public.users (id),
  deleted_at  timestamptz,
  search_vector tsvector,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.contacts is
  'People. Email is the deduplication key (duplicate warning on create, not a hard block). Soft-deleted via deleted_at.';

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- full-text search vectors (maintained by trigger; GIN-indexed)
-- ---------------------------------------------------------------------------
create or replace function public.contacts_search_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.first_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.email, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.title, '')), 'C');
  return new;
end;
$$;

create trigger contacts_search_vector
  before insert or update of first_name, last_name, email, title on public.contacts
  for each row execute function public.contacts_search_trigger();

create index contacts_search_idx on public.contacts using gin (search_vector);
create index contacts_email_idx on public.contacts (lower(email)) where deleted_at is null;
create index companies_owner_idx on public.companies (owner_id) where deleted_at is null;
create index contacts_owner_idx on public.contacts (owner_id) where deleted_at is null;
create index contacts_company_idx on public.contacts (company_id) where deleted_at is null;

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
