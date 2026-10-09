-- =============================================================================
-- 00009_stage_entered_at.sql — track when a deal entered its current stage
--
-- Powers the days-in-stage badge (strict slate/amber/red urgency scale).
-- Backfilled from stage_history; maintained by the stage-change trigger.
-- =============================================================================

alter table public.deals add column stage_entered_at timestamptz not null default now();

-- Backfill: latest stage_history entry per deal, else the deal's created_at.
update public.deals d
   set stage_entered_at = coalesce(
         (select max(sh.changed_at)
            from public.stage_history sh
           where sh.deal_id = d.id),
         d.created_at
       );

comment on column public.deals.stage_entered_at is
  'When the deal entered its current stage. Powers the days-in-stage urgency badge.';

-- Keep it fresh: the stage-change trigger resets it whenever stage_id changes.
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

    new.stage_entered_at := now();
  end if;

  return new;
end;
$$;
