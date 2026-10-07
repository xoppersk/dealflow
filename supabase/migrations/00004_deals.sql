-- =============================================================================
-- 00004_deals.sql — deals, deal_contacts, stage-change trigger
--
--   * public.deals — the pipeline's unit of work
--   * public.deal_contacts — many-to-many deals <-> contacts
--   * handle_deal_stage_change() — BEFORE UPDATE trigger (defense in depth):
--       - rejects moves OUT of a closed stage (reopen requires the explicit
--         reopenDeal action, manager/admin only)
--       - sets/clears closed_at when entering/leaving closed stages
--       - bumps last_touched_at on every update
--   * NOTE: `version` (optimistic-concurrency counter) is incremented ONLY by
--     the moveDeal Server Action (UPDATE ... WHERE version = $clientVersion),
--     never by triggers — the 409 check depends on single-writer increments.
-- =============================================================================

create table public.deals (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  company_id      uuid references public.companies (id) on delete set null,
  stage_id        uuid not null references public.pipeline_stages (id) on delete restrict,
  value           numeric(12, 2) not null default 0 check (value >= 0),
  currency        text not null default 'USD',
  probability     integer check (probability between 0 and 100),
  close_date      date,
  owner_id        uuid not null references public.users (id) on delete restrict,
  deal_type       text not null default 'new_business'
                    check (deal_type in ('new_business', 'renewal', 'expansion', 'other')),
  source          text,
  description     text,
  board_position  integer not null default 0,
  version         integer not null default 1,
  deleted_at      timestamptz,
  closed_at       timestamptz,
  last_touched_at timestamptz not null default now(),
  created_by      uuid not null references public.users (id),
  search_vector   tsvector,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.deals is
  'The pipeline''s unit of work. version is the optimistic-concurrency counter for kanban drag conflicts (TECHNICAL-REQUIREMENTS.md §6). Soft-deleted via deleted_at.';

create table public.deal_contacts (
  deal_id    uuid not null references public.deals (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  role       text,
  created_at timestamptz not null default now(),
  primary key (deal_id, contact_id)
);

comment on table public.deal_contacts is
  'Many-to-many: deals <-> contacts (a deal can involve multiple people, each with a role).';

create trigger deals_updated_at
  before update on public.deals
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- full-text search vector for deals
-- ---------------------------------------------------------------------------
create or replace function public.deals_search_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

create trigger deals_search_vector
  before insert or update of name, description on public.deals
  for each row execute function public.deals_search_trigger();

create index deals_search_idx on public.deals using gin (search_vector);
create index deals_stage_idx on public.deals (stage_id) where deleted_at is null;
create index deals_owner_idx on public.deals (owner_id) where deleted_at is null;
create index deals_company_idx on public.deals (company_id) where deleted_at is null;
create index deals_touched_idx on public.deals (last_touched_at) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- stage-change trigger: transition rules + closed_at + last_touched_at
-- ---------------------------------------------------------------------------
create or replace function public.handle_deal_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  from_closed boolean;
  to_closed_won boolean;
  to_closed_lost boolean;
begin
  -- last_touched_at bumps on every deal update (edits, moves, activity links).
  new.last_touched_at := now();

  if new.stage_id is distinct from old.stage_id then
    select (ps.is_closed_won or ps.is_closed_lost)
      into from_closed
      from public.pipeline_stages ps
     where ps.id = old.stage_id;

    -- Defense in depth: leaving a closed stage by plain UPDATE is rejected.
    -- Reopening goes through the reopenDeal action (manager/admin + reason).
    if coalesce(from_closed, false) then
      raise exception 'DEALFLOW_CLOSED_STAGE_MOVE: cannot move a deal out of a closed stage without reopening';
    end if;

    select ps.is_closed_won, ps.is_closed_lost
      into to_closed_won, to_closed_lost
      from public.pipeline_stages ps
     where ps.id = new.stage_id;

    if coalesce(to_closed_won, false) or coalesce(to_closed_lost, false) then
      new.closed_at := now();
    else
      new.closed_at := null;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_deal_stage_change() is
  'BEFORE UPDATE on deals: enforces stage transition rules at the database level (mirrors the moveDeal Server Action), manages closed_at, and bumps last_touched_at.';

create trigger deals_stage_change
  before update on public.deals
  for each row execute function public.handle_deal_stage_change();

alter table public.deals enable row level security;
alter table public.deal_contacts enable row level security;
