-- =============================================================================
-- 00007_rls.sql — Row Level Security policies (the authorization layer)
--
-- Deny-by-default: RLS is enabled on every table; no permissive policy means
-- no access. Conventions: reps see their own records plus unowned ones;
-- managers and admins see everything. The service-role key bypasses RLS and
-- is used only for admin operations that cannot run as the signed-in user.
-- =============================================================================

-- Helper: manager or admin check for policies.
create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('manager', 'admin');
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_manager_or_admin() to authenticated;

-- A rep may update their own profile (name/avatar) but never their own role
-- or active flag — enforced by trigger, since RLS cannot compare OLD vs NEW.
create or replace function public.enforce_user_privilege_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active then
    if public.current_user_role() is distinct from 'admin' then
      raise exception 'DEALFLOW_ROLE_GUARD: only admins can change roles or deactivate users';
    end if;
  end if;
  return new;
end;
$$;

create trigger users_privilege_guard
  before update on public.users
  for each row execute function public.enforce_user_privilege_guard();

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy users_select on public.users
  for select to authenticated
  using (is_active = true or auth.uid() = id);

create policy users_update_self on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy users_update_admin on public.users
  for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- No INSERT policy (service role / auth mirror trigger only). No DELETE.

-- ---------------------------------------------------------------------------
-- pipeline_stages
-- ---------------------------------------------------------------------------
create policy stages_select on public.pipeline_stages
  for select to authenticated
  using (true);

create policy stages_write_manager on public.pipeline_stages
  for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create policy companies_select on public.companies
  for select to authenticated
  using (
    deleted_at is null and (
      owner_id = auth.uid()
      or created_by = auth.uid()
      or owner_id is null
      or public.is_manager_or_admin()
    )
  );

create policy companies_insert on public.companies
  for insert to authenticated
  with check (created_by = auth.uid());

create policy companies_update on public.companies
  for update to authenticated
  using (
    deleted_at is null and (
      owner_id = auth.uid()
      or created_by = auth.uid()
      or public.is_manager_or_admin()
    )
  )
  with check (
    owner_id = auth.uid()
    or created_by = auth.uid()
    or public.is_manager_or_admin()
  );

-- No DELETE (soft delete via UPDATE setting deleted_at; hard delete is
-- admin-only through the audit-logged service-role action).

-- ---------------------------------------------------------------------------
-- contacts (same shape as companies)
-- ---------------------------------------------------------------------------
create policy contacts_select on public.contacts
  for select to authenticated
  using (
    deleted_at is null and (
      owner_id = auth.uid()
      or created_by = auth.uid()
      or owner_id is null
      or public.is_manager_or_admin()
    )
  );

create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (created_by = auth.uid());

create policy contacts_update on public.contacts
  for update to authenticated
  using (
    deleted_at is null and (
      owner_id = auth.uid()
      or created_by = auth.uid()
      or public.is_manager_or_admin()
    )
  )
  with check (
    owner_id = auth.uid()
    or created_by = auth.uid()
    or public.is_manager_or_admin()
  );

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------
create policy deals_select on public.deals
  for select to authenticated
  using (
    deleted_at is null and (
      owner_id = auth.uid()
      or public.is_manager_or_admin()
    )
  );

create policy deals_insert on public.deals
  for insert to authenticated
  with check (
    deleted_at is null and (
      owner_id = auth.uid()
      or public.is_manager_or_admin()
    )
  );

create policy deals_update on public.deals
  for update to authenticated
  using (
    deleted_at is null and (
      owner_id = auth.uid()
      or public.is_manager_or_admin()
    )
  )
  with check (
    owner_id = auth.uid()
    or public.is_manager_or_admin()
  );

-- No DELETE for app roles. Hard delete is admin-only via a service-role
-- Server Action that writes an audit_log entry before deleting.

-- ---------------------------------------------------------------------------
-- deal_contacts (follows the parent deal's visibility)
-- ---------------------------------------------------------------------------
create policy deal_contacts_select on public.deal_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

create policy deal_contacts_insert on public.deal_contacts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.deals d
      where d.id = deal_id
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

create policy deal_contacts_delete on public.deal_contacts
  for delete to authenticated
  using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create policy activities_select on public.activities
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_manager_or_admin()
    or (
      deal_id is not null and exists (
        select 1 from public.deals d
        where d.id = deal_id
          and d.deleted_at is null
          and (d.owner_id = auth.uid() or public.is_manager_or_admin())
      )
    )
    or (
      contact_id is not null and exists (
        select 1 from public.contacts c
        where c.id = contact_id
          and c.deleted_at is null
          and (
            c.owner_id = auth.uid()
            or c.created_by = auth.uid()
            or c.owner_id is null
            or public.is_manager_or_admin()
          )
      )
    )
  );

create policy activities_insert on public.activities
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      (
        deal_id is not null and exists (
          select 1 from public.deals d
          where d.id = deal_id
            and d.deleted_at is null
            and (d.owner_id = auth.uid() or public.is_manager_or_admin())
        )
      )
      or (
        contact_id is not null and exists (
          select 1 from public.contacts c
          where c.id = contact_id
            and c.deleted_at is null
            and (
              c.owner_id = auth.uid()
              or c.created_by = auth.uid()
              or c.owner_id is null
              or public.is_manager_or_admin()
            )
        )
      )
    )
  );

-- Content is append-only (enforced by the activities_immutable trigger);
-- the only permitted mutation is marking a follow-up done (completed_at).
create policy activities_update_owner on public.activities
  for update to authenticated
  using (owner_id = auth.uid() or public.is_manager_or_admin())
  with check (owner_id = auth.uid() or public.is_manager_or_admin());

-- No DELETE for app roles.

-- ---------------------------------------------------------------------------
-- stage_history (follows the parent deal's visibility; append-only)
-- ---------------------------------------------------------------------------
create policy stage_history_select on public.stage_history
  for select to authenticated
  using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

create policy stage_history_insert on public.stage_history
  for insert to authenticated
  with check (
    changed_by = auth.uid()
    and exists (
      select 1 from public.deals d
      where d.id = deal_id
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

-- No UPDATE / DELETE (immutable).

-- ---------------------------------------------------------------------------
-- audit_log (admin-readable, append-only)
-- ---------------------------------------------------------------------------
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.current_user_role() = 'admin');

create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (actor_id = auth.uid());

-- No UPDATE / DELETE for any role.

-- ---------------------------------------------------------------------------
-- deal_attachments (follows the parent deal's visibility)
-- ---------------------------------------------------------------------------
create policy deal_attachments_select on public.deal_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

create policy deal_attachments_insert on public.deal_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.deals d
      where d.id = deal_id
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

create policy deal_attachments_delete on public.deal_attachments
  for delete to authenticated
  using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- invites (admin only)
-- ---------------------------------------------------------------------------
create policy invites_admin on public.invites
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- storage.objects (mirror the table policies; path-scoped)
-- ---------------------------------------------------------------------------
-- deal-attachments: path deals/<deal_id>/<filename>; readable/writable only
-- when the caller can read the deal.
create policy "deal-attachments read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deal-attachments'
    and exists (
      select 1 from public.deals d
      where d.id::text = (storage.foldername(name))[2]
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

create policy "deal-attachments write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deal-attachments'
    and exists (
      select 1 from public.deals d
      where d.id::text = (storage.foldername(name))[2]
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

create policy "deal-attachments delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'deal-attachments'
    and exists (
      select 1 from public.deals d
      where d.id::text = (storage.foldername(name))[2]
        and d.deleted_at is null
        and (d.owner_id = auth.uid() or public.is_manager_or_admin())
    )
  );

-- avatars: path <user_id>/<filename>; anyone authenticated can read (assignee
-- avatars); users write only their own folder.
create policy "avatars read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

create policy "avatars write own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
