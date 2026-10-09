-- =============================================================================
-- 00008_realtime_fts.sql — realtime publication + global search RPC
--
--   * dealflow_realtime publication for the app's live tables
--   * REPLICA IDENTITY FULL on deals/activities so UPDATE payloads carry
--     old+new rows (the `version` column rides along for conflict detection)
--   * search_all() — Postgres full-text search across deals, contacts,
--     companies; SECURITY INVOKER so RLS filters every result
-- =============================================================================

create publication dealflow_realtime for table
  public.deals,
  public.activities,
  public.pipeline_stages,
  public.deal_contacts;

alter table public.deals replica identity full;
alter table public.activities replica identity full;

comment on publication dealflow_realtime is
  'Live tables for Supabase Realtime: workspace:deals, workspace:activities, workspace:stages channels.';

-- ---------------------------------------------------------------------------
-- search_all(): global typeahead search (<500ms, debounced 200ms client-side)
-- ---------------------------------------------------------------------------
create or replace function public.search_all(p_query text)
returns table (
  kind     text,
  id       uuid,
  title    text,
  subtitle text
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select plainto_tsquery('english', p_query) as tsq
  )
  select s.kind, s.id, s.title, s.subtitle
    from (
      select 'deal'::text as kind,
             d.id as id,
             d.name as title,
             c.name as subtitle,
             ts_rank(d.search_vector, q.tsq) as rank
        from public.deals d
        left join public.companies c on c.id = d.company_id,
             q
       where d.deleted_at is null
         and d.search_vector @@ q.tsq
      union all
      select 'contact'::text as kind,
             ct.id as id,
             (ct.first_name || ' ' || ct.last_name)::text as title,
             ct.email as subtitle,
             ts_rank(ct.search_vector, q.tsq) as rank
        from public.contacts ct,
             q
       where ct.deleted_at is null
         and ct.search_vector @@ q.tsq
      union all
      select 'company'::text as kind,
             co.id as id,
             co.name as title,
             co.industry as subtitle,
             ts_rank(to_tsvector('english', coalesce(co.name, '')), q.tsq) as rank
        from public.companies co,
             q
       where co.deleted_at is null
         and to_tsvector('english', coalesce(co.name, '')) @@ q.tsq
    ) s
   order by s.rank desc
   limit 15;
$$;

comment on function public.search_all(text) is
  'Global search across deals, contacts, and companies (Postgres full-text search). SECURITY INVOKER: RLS policies filter every result to rows the caller may see.';

grant execute on function public.search_all(text) to authenticated;
