-- =============================================================================
-- 00010_reopen_support.sql — privileged reopen out of closed stages
--
-- Extends handle_deal_stage_change() (00004/00009): leaving a closed stage by
-- plain UPDATE is still rejected, but a manager/admin may move a deal OUT of
-- a closed stage when the same UPDATE clears closed_at — exactly what the
-- reopenDeal Server Action does atomically (stage -> open stage,
-- closed_at -> NULL, reason recorded via checkReopen + audit_log).
--
-- A rep attempting the same UPDATE still hits DEALFLOW_CLOSED_STAGE_MOVE,
-- because the exception requires BOTH closed_at IS NULL AND
-- public.is_manager_or_admin(). There is no way to leave a closed stage
-- while keeping closed_at set, so the "closed" audit signal can't be
-- silently dropped.
-- =============================================================================

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

    if coalesce(from_closed, false) then
      -- Defense in depth: leaving a closed stage by plain UPDATE is rejected,
      -- unless this is a privileged reopen — a manager/admin clearing
      -- closed_at in the same UPDATE (the reopenDeal Server Action does both
      -- atomically; checkReopen enforces the role + reason in the app).
      if not (new.closed_at is null and public.is_manager_or_admin()) then
        raise exception 'DEALFLOW_CLOSED_STAGE_MOVE: cannot move a deal out of a closed stage without reopening';
      end if;
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

    -- stage_entered_at resets on every stage change (powers days-in-stage).
    new.stage_entered_at := now();
  end if;

  return new;
end;
$$;

comment on function public.handle_deal_stage_change() is
  'BEFORE UPDATE on deals: enforces stage transition rules at the database level (mirrors the moveDeal Server Action), manages closed_at, resets stage_entered_at, and bumps last_touched_at. Managers/admins may leave a closed stage only via a reopen that clears closed_at in the same UPDATE (reopenDeal).';
