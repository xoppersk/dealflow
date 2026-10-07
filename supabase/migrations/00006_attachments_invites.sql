-- =============================================================================
-- 00006_attachments_invites.sql — deal attachments, invites, storage buckets
--
--   * public.deal_attachments — metadata for files in Supabase Storage
--   * public.invites — pending email invitations (7-day expiry)
--   * storage buckets: deal-attachments (private), avatars (private)
-- =============================================================================

create table public.deal_attachments (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals (id) on delete cascade,
  file_name   text not null,
  storage_path text not null,
  mime_type   text not null,
  size_bytes  integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null references public.users (id),
  created_at  timestamptz not null default now()
);

comment on table public.deal_attachments is
  'Metadata for files attached to deals (proposals, contracts). Files live in the deal-attachments Storage bucket; downloads use signed URLs with 1-hour expiry.';

create index deal_attachments_deal_idx on public.deal_attachments (deal_id);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        public.user_role not null default 'rep',
  token       uuid not null unique default gen_random_uuid(),
  invited_by  uuid not null references public.users (id),
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now()
);

comment on table public.invites is
  'Pending email invitations. One pending invite per email (partial unique index). Expired invites are cleaned by a weekly cron.';

create unique index invites_pending_email_uniq
  on public.invites (lower(email)) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('deal-attachments', 'deal-attachments', false),
  ('avatars', 'avatars', false)
on conflict (id) do nothing;

alter table public.deal_attachments enable row level security;
alter table public.invites enable row level security;
