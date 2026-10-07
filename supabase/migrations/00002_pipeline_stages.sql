-- =============================================================================
-- 00002_pipeline_stages.sql — kanban stages + default seed
--
--   * public.pipeline_stages — ordered sales stages for the kanban board
--   * Exactly one closed-won and one closed-lost stage (partial unique indexes)
--   * Seeds the 7 default stages
-- =============================================================================

create table public.pipeline_stages (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  position            integer not null unique,
  color               text not null default '#64748B',
  is_closed_won       boolean not null default false,
  is_closed_lost      boolean not null default false,
  default_probability integer not null default 0 check (default_probability between 0 and 100),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.pipeline_stages is
  'Ordered kanban stages. Managers/admins can add, rename, and reorder them; exactly one won and one lost stage must exist.';

-- Exactly one closed-won and one closed-lost stage.
create unique index pipeline_stages_single_won
  on public.pipeline_stages (is_closed_won) where is_closed_won;
create unique index pipeline_stages_single_lost
  on public.pipeline_stages (is_closed_lost) where is_closed_lost;

create trigger pipeline_stages_updated_at
  before update on public.pipeline_stages
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- seed: the 7 default stages
-- ---------------------------------------------------------------------------
insert into public.pipeline_stages (name, position, color, is_closed_won, is_closed_lost, default_probability)
values
  ('New Lead',    0, '#0F766E', false, false, 10),
  ('Discovery',   1, '#2563EB', false, false, 25),
  ('Proposal',    2, '#7C3AED', false, false, 50),
  ('Negotiation', 3, '#D97706', false, false, 75),
  ('Closed Won',  4, '#15803D', true,  false, 100),
  ('Closed Lost', 5, '#78716C', false, true,   0)
on conflict (position) do nothing;

alter table public.pipeline_stages enable row level security;
