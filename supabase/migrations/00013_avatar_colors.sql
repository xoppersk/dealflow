-- =============================================================================
-- 00013_avatar_colors.sql — per-person / per-company display colours (v2)
--
-- Contract amendment (coordinator, 2026-10-22): the v2 types carry
-- Person.avatarBg/avatarColor and Company.mgBg/mgColor. These nullable text
-- columns let the owner seed store the fixture colours exactly; the data
-- layer falls back to a deterministic palette when NULL.
-- IDEMPOTENT: safe to re-run.
-- =============================================================================

alter table public.users     add column if not exists avatar_bg    text;
alter table public.users     add column if not exists avatar_color text;
alter table public.companies add column if not exists mg_bg        text;
alter table public.companies add column if not exists mg_color     text;

comment on column public.users.avatar_bg       is 'v2 display colour: avatar background (fixture canon); NULL = deterministic palette fallback.';
comment on column public.users.avatar_color    is 'v2 display colour: avatar foreground (fixture canon); NULL = deterministic palette fallback.';
comment on column public.companies.mg_bg       is 'v2 display colour: monogram background (fixture canon); NULL = deterministic palette fallback.';
comment on column public.companies.mg_color    is 'v2 display colour: monogram foreground (fixture canon); NULL = deterministic palette fallback.';
