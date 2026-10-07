-- =============================================================================
-- 00005_activities_history.sql — activities, stage_history, audit_log
--
--   * public.activities — calls, emails, meetings, notes (APPEND-ONLY: after
--     creation only completed_at may change; enforced by trigger)
--   * public.stage_history — immutable audit of every stage movement
--   * public.audit_log — who changed what (admin accountability)
--   * activity insert trigger bumps the linked deal's last_touched_at
-- =============================================================================

create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  type         public.activity_type not null,
  subject      text,
  body         text,
  occurred_at  timestamptz not null default now(),
  deal_id      uuid references public.deals (id) on delete cascade,
  contact_id   uuid references public.contacts (id) on delete set null,
  owner_id     uuid not null references public.users (id) on delete restrict,
  is_follow_up boolean not null default false,
  due_at       timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint activities_link_check check (deal_id is not null or contact_id is not null)
);

comment on table public.activities is
  'Activity timeline. APPEND-ONLY: content is immutable after creation — the only permitted mutation is setting completed_at when a follow-up is marked done. Corrections are logged as new activities.';

create trigger activities_updated_at
  before update on public.activities
  for each row execute function public.handle_updated_at();

-- Enforce append-only: on UPDATE, only completed_at may change.
create or replace function public.enforce_activity_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.type is distinct from old.type
     or new.subject is distinct from old.subject
     or new.body is distinct from old.body
     or new.occurred_at is distinct from old.occurred_at
     or new.deal_id is distinct from old.deal_id
     or new.contact_id is distinct from old.contact_id
     or new.owner_id is distinct from old.owner_id
     or new.is_follow_up is distinct from old.is_follow_up
     or new.due_at is distinct from old.due_at then
    raise exception 'DEALFLOW_ACTIVITY_IMMUTABLE: activity content cannot be edited — log a new activity instead';
  end if;
  return new;
end;
$$;

create trigger activities_immutable
  before update on public.activities
  for each row execute function public.enforce_activity_immutable();

-- Logging an activity bumps the linked deal's last_touched_at (touch rule).
create or replace function public.bump_deal_on_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deal_id is not null then
    update public.deals
       set last_touched_at = now()
     where id = new.deal_id;
  end if;
  return new;
end;
$$;

create trigger activities_bump_deal
  after insert on public.activities
  for each row execute function public.bump_deal_on_activity();

create index activities_owner_due_idx on public.activities (owner_id, due_at)
  where is_follow_up and completed_at is null;
create index activities_deal_idx on public.activities (deal_id, occurred_at desc);
create index activities_contact_idx on public.activities (contact_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- stage_history (immutable)
-- ---------------------------------------------------------------------------
create table public.stage_history (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals (id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages (id),
  to_stage_id   uuid not null references public.pipeline_stages (id),
  changed_by    uuid not null references public.users (id),
  changed_at    timestamptz not null default now()
);

comment on table public.stage_history is
  'Immutable audit of every stage movement. Written by the moveDeal Server Action — never updated or deleted by app code.';

create index stage_history_deal_idx on public.stage_history (deal_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- audit_log (append-only, admin-readable)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references public.users (id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid not null,
  diff        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.audit_log is
  'Who changed what: deal reassignments, role changes, hard deletes, rejected move conflicts. Append-only — no UPDATE/DELETE grants to any app role. diff carries before/after field changes, never full PII dumps.';

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

alter table public.activities enable row level security;
alter table public.stage_history enable row level security;
alter table public.audit_log enable row level security;
