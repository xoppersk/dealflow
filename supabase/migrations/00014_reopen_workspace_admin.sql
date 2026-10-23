-- 00014_reopen_workspace_admin.sql
-- Coordinator migration (2026-10-22, production-readiness run).
--
-- Problem: v1's handle_deal_stage_change() only lets a GLOBAL manager/admin
-- (public.users.role) move a deal out of a closed stage. Under the 00012
-- workspace tenancy, a workspace OWNER whose global role is 'rep' could never
-- reopen their own deal — the v2 UI's reopen/undo flow would fail at the DB.
--
-- Fix: the same trigger, with the reopen gate widened to also allow a
-- workspace admin of the deal's workspace (workspace owners hold an 'admin'
-- membership row, so they are covered). Global manager/admin path unchanged.
-- Idempotent: CREATE OR REPLACE with the identical body otherwise.

create or replace function public.handle_deal_stage_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  from_closed boolean;
  to_closed_won boolean;
  to_closed_lost boolean;
begin
  new.last_touched_at := now();
  if new.stage_id is distinct from old.stage_id then
    select (ps.is_closed_won or ps.is_closed_lost)
      into from_closed
      from public.pipeline_stages ps
     where ps.id = old.stage_id;
    if coalesce(from_closed, false) then
      if not (new.closed_at is null
              and (public.is_manager_or_admin()
                   or public.workspace_role(new.workspace_id) = 'admin')) then
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
    new.stage_entered_at := now();
  end if;
  return new;
end;
$function$;
