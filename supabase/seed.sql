-- =============================================================================
-- seed.sql — demo workspace for local development
--
-- Seeds 3 users (rep/manager/admin), 8 companies, 16 contacts, 14 deals
-- across pipeline stages, activities, and stage history — a realistic board
-- on first load.
--
-- Users are inserted into public.users directly with fixed UUIDs. In a real
-- project the invite flow creates auth.users rows (the mirror trigger fills
-- public.users); these seed rows stand in for the demo team so FKs resolve.
-- Run via the Supabase SQL editor or `supabase db seed`.
-- Idempotent: every insert is guarded by ON CONFLICT DO NOTHING.
-- =============================================================================

do $$
declare
  maya_id  uuid := 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
  jon_id   uuid := 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';
  priya_id uuid := 'c3d4e5f6-a7b8-4c9d-0e1f-a2b3c4d5e6f7';

  stage_new        uuid;
  stage_discovery  uuid;
  stage_proposal   uuid;
  stage_negotiation uuid;
  stage_won        uuid;
  stage_lost       uuid;

  co_northwind uuid; co_harbor uuid; co_bluepine uuid; co_copper uuid;
  co_driftwell uuid; co_ember uuid; co_foxglove uuid; co_granite uuid;

  c_maya_1 uuid; c_maya_2 uuid;
  d1 uuid; d2 uuid; d3 uuid;
begin
  -- -----------------------------------------------------------------------
  -- users
  -- -----------------------------------------------------------------------
  insert into public.users (id, email, full_name, role)
  values
    (maya_id,  'maya@dealflow.example.com',  'Maya Chen',   'rep'),
    (jon_id,   'jon@dealflow.example.com',   'Jon Okafor',  'manager'),
    (priya_id, 'priya@dealflow.example.com', 'Priya Nair',  'admin')
  on conflict (id) do nothing;

  -- -----------------------------------------------------------------------
  -- stages
  -- -----------------------------------------------------------------------
  select id into stage_new         from public.pipeline_stages where name = 'New Lead';
  select id into stage_discovery   from public.pipeline_stages where name = 'Discovery';
  select id into stage_proposal    from public.pipeline_stages where name = 'Proposal';
  select id into stage_negotiation from public.pipeline_stages where name = 'Negotiation';
  select id into stage_won         from public.pipeline_stages where name = 'Closed Won';
  select id into stage_lost        from public.pipeline_stages where name = 'Closed Lost';

  -- -----------------------------------------------------------------------
  -- companies
  -- -----------------------------------------------------------------------
  insert into public.companies (id, name, industry, website, size, owner_id, created_by)
  values
    (gen_random_uuid(), 'Northwind Traders',      'Retail',      'https://northwind.example.com', '51–200',  maya_id, maya_id),
    (gen_random_uuid(), 'Harborlight',            'Logistics',   'https://harborlight.example.com', '201–1000', maya_id, maya_id),
    (gen_random_uuid(), 'Bluepine Outfitters',    'Retail',      'https://bluepine.example.com',  '11–50',   maya_id, maya_id),
    (gen_random_uuid(), 'Copperline Freight',     'Logistics',   null,                            '51–200',  jon_id,  jon_id),
    (gen_random_uuid(), 'Driftwell Health',       'Healthcare',  'https://driftwell.example.com', '1000+',   jon_id,  jon_id),
    (gen_random_uuid(), 'Emberline Foods',        'Food & Bev',  null,                            '11–50',   maya_id, maya_id),
    (gen_random_uuid(), 'Foxglove Legal',         'Legal',       'https://foxglove.example.com',  '1–10',    priya_id, priya_id),
    (gen_random_uuid(), 'Granite Peak Construction','Construction', null,                         '201–1000', jon_id,  jon_id)
  on conflict (id) do nothing;

  select id into co_northwind from public.companies where name = 'Northwind Traders';
  select id into co_harbor    from public.companies where name = 'Harborlight';
  select id into co_bluepine  from public.companies where name = 'Bluepine Outfitters';
  select id into co_copper    from public.companies where name = 'Copperline Freight';
  select id into co_driftwell from public.companies where name = 'Driftwell Health';
  select id into co_ember     from public.companies where name = 'Emberline Foods';
  select id into co_foxglove  from public.companies where name = 'Foxglove Legal';
  select id into co_granite   from public.companies where name = 'Granite Peak Construction';

  -- -----------------------------------------------------------------------
  -- contacts (2 per company)
  -- -----------------------------------------------------------------------
  insert into public.contacts
    (first_name, last_name, email, phone, title, company_id, owner_id, created_by)
  values
    ('Ava',   'Mensah',  'ava.mensah@northwind.example.com',  '+16155550101', 'VP Operations',   co_northwind, maya_id, maya_id),
    ('Liam',  'Boateng', 'liam.boateng@northwind.example.com','+16155550102', 'Procurement Lead', co_northwind, maya_id, maya_id),
    ('Sofia', 'Reyes',   'sofia.reyes@harborlight.example.com','+16155550201', 'COO',             co_harbor,    maya_id, maya_id),
    ('Noah',  'Diallo',  'noah.diallo@harborlight.example.com','+16155550202', 'Fleet Manager',   co_harbor,    maya_id, maya_id),
    ('Emma',  'Kargbo',  'emma.kargbo@bluepine.example.com',  '+16155550301', 'Founder',         co_bluepine,  maya_id, maya_id),
    ('Lucas', 'Sesay',   'lucas.sesay@bluepine.example.com',  '+16155550302', 'Head of Retail',  co_bluepine,  maya_id, maya_id),
    ('Mia',   'Conteh',  'mia.conteh@copperline.example.com', '+16155550401', 'Logistics Director', co_copper, jon_id,  jon_id),
    ('Ethan', 'Turay',   'ethan.turay@copperline.example.com','+16155550402', 'Ops Manager',     co_copper,    jon_id,  jon_id),
    ('Aisha', 'Bah',     'aisha.bah@driftwell.example.com',   '+16155550501', 'CIO',             co_driftwell, jon_id,  jon_id),
    ('James', 'Koroma',  'james.koroma@driftwell.example.com','+16155550502', 'Facilities Lead', co_driftwell, jon_id,  jon_id),
    ('Olivia','Kamara',  'olivia.kamara@emberline.example.com','+16155550601', 'Owner',           co_ember,     maya_id, maya_id),
    ('Henry', 'Jalloh',  'henry.jalloh@emberline.example.com','+16155550602', 'Kitchen Manager', co_ember,     maya_id, maya_id),
    ('Grace', 'Bangura', 'grace.bangura@foxglove.example.com','+16155550701', 'Managing Partner', co_foxglove, priya_id, priya_id),
    ('Leo',   'Fofana',  'leo.fofana@foxglove.example.com',   '+16155550702', 'Office Manager',  co_foxglove,  priya_id, priya_id),
    ('Nora',  'Sillah',  'nora.sillah@granitepeak.example.com','+16155550801', 'Project Director', co_granite,  jon_id,  jon_id),
    ('Owen',  'Dumbuya', 'owen.dumbuya@granitepeak.example.com','+16155550802', 'Site Lead',      co_granite,   jon_id,  jon_id)
  on conflict (id) do nothing;

  -- -----------------------------------------------------------------------
  -- deals (the signature board)
  -- -----------------------------------------------------------------------
  -- Helper CTE-free inserts; stage_history entries record creation.
  insert into public.deals
    (id, name, company_id, stage_id, value, probability, close_date, owner_id,
     deal_type, source, description, board_position, created_by, last_touched_at)
  values
    (gen_random_uuid(), 'Harborlight Renewal', co_harbor, stage_proposal, 48500, 50,
      current_date + 21, maya_id, 'renewal', 'Inbound',
      'Annual freight contract renewal. Sofia wants volume pricing for Q1.', 0, maya_id,
      now() - interval '3 days'),
    (gen_random_uuid(), 'Northwind Traders — POS rollout', co_northwind, stage_negotiation, 120000, 75,
      current_date + 14, maya_id, 'new_business', 'Outbound',
      'Multi-location POS rollout. Legal reviewing MSA.', 0, maya_id,
      now() - interval '21 days'),
    (gen_random_uuid(), 'Driftwell Health — pilot', co_driftwell, stage_discovery, 75000, null,
      current_date + 45, jon_id, 'new_business', 'Partner',
      'Pilot for 3 facilities. Awaiting security review.', 0, jon_id,
      now() - interval '2 days'),
    (gen_random_uuid(), 'Bluepine — holiday inventory', co_bluepine, stage_new, 18500, null,
      current_date + 30, maya_id, 'expansion', 'Inbound', 'Seasonal restock expansion.', 0, maya_id,
      now() - interval '16 days'),
    (gen_random_uuid(), 'Copperline — route optimization', co_copper, stage_proposal, 64000, 50,
      current_date + 28, jon_id, 'new_business', 'Referral', null, 1, jon_id,
      now() - interval '6 days'),
    (gen_random_uuid(), 'Emberline — catering contract', co_ember, stage_negotiation, 22000, 75,
      current_date + 10, maya_id, 'new_business', 'Inbound', null, 1, maya_id,
      now() - interval '9 days'),
    (gen_random_uuid(), 'Foxglove — retainer', co_foxglove, stage_discovery, 30000, null,
      current_date + 60, priya_id, 'new_business', 'Outbound', null, 0, priya_id,
      now() - interval '1 day'),
    (gen_random_uuid(), 'Granite Peak — site software', co_granite, stage_new, 54000, null,
      current_date + 50, jon_id, 'new_business', 'Inbound', null, 0, jon_id,
      now() - interval '20 days'),
    (gen_random_uuid(), 'Northwind — support renewal', co_northwind, stage_won, 12000, 100,
      current_date - 5, maya_id, 'renewal', 'Inbound', 'Signed last week.',
      0, maya_id, now() - interval '5 days'),
    (gen_random_uuid(), 'Bluepine — spring line (lost)', co_bluepine, stage_lost, 9000, 0,
      current_date - 12, maya_id, 'expansion', 'Outbound', 'Lost to competitor on price.',
      0, maya_id, now() - interval '12 days')
  on conflict (id) do nothing;

  -- Stage history for the two in-flight signature deals.
  select id into d1 from public.deals where name = 'Harborlight Renewal';
  select id into d2 from public.deals where name = 'Northwind Traders — POS rollout';
  select id into d3 from public.deals where name = 'Driftwell Health — pilot';

  insert into public.stage_history (deal_id, from_stage_id, to_stage_id, changed_by, changed_at)
  values
    (d1, null, stage_new, maya_id, now() - interval '20 days'),
    (d1, stage_new, stage_discovery, maya_id, now() - interval '12 days'),
    (d1, stage_discovery, stage_proposal, maya_id, now() - interval '3 days'),
    (d2, null, stage_new, maya_id, now() - interval '40 days'),
    (d2, stage_new, stage_negotiation, jon_id, now() - interval '21 days'),
    (d3, null, stage_new, jon_id, now() - interval '10 days'),
    (d3, stage_new, stage_discovery, jon_id, now() - interval '2 days')
  on conflict (id) do nothing;

  -- Link contacts to the signature deals.
  select id into c_maya_1 from public.contacts where email = 'sofia.reyes@harborlight.example.com';
  select id into c_maya_2 from public.contacts where email = 'ava.mensah@northwind.example.com';

  insert into public.deal_contacts (deal_id, contact_id, role)
  values
    (d1, c_maya_1, 'Decision maker'),
    (d2, c_maya_2, 'Champion')
  on conflict do nothing;

  -- -----------------------------------------------------------------------
  -- activities (timeline depth for the signature deals)
  -- -----------------------------------------------------------------------
  insert into public.activities
    (type, subject, body, occurred_at, deal_id, contact_id, owner_id, is_follow_up, due_at, completed_at)
  values
    ('call', 'Discovery call with Sofia', 'Walked through current freight spend. Open to volume pricing.',
      now() - interval '12 days', d1, c_maya_1, maya_id, false, null, null),
    ('email', 'Sent renewal proposal', 'Proposal v2 with Q1 volume tiers attached.',
      now() - interval '3 days', d1, c_maya_1, maya_id, false, null, null),
    ('call', null, 'Follow-up Friday: confirm proposal receipt and timeline.',
      now() - interval '3 days', d1, c_maya_1, maya_id, true, now() + interval '3 days', null),
    ('meeting', 'MSA review with legal', 'Legal flagged the liability cap; sent redlines.',
      now() - interval '9 days', d2, c_maya_2, maya_id, false, null, null),
    ('note', 'Coaching note', 'Stalled 21 days in Negotiation — check in with Ava before Friday.',
      now() - interval '1 day', d2, null, jon_id, false, null, null),
    ('call', null, 'Overdue: security review follow-up with Aisha.',
      now() - interval '16 days', d3, null, jon_id, true, now() - interval '2 days', null)
  on conflict (id) do nothing;

  raise notice 'Dealflow demo workspace seeded.';
end $$;
