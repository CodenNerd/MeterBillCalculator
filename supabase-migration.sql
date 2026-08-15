-- Run this in Supabase Dashboard → SQL Editor.
-- Adds history tracking for the "actual bill vs calculated bill" line-loss comparison.

create table if not exists billing_cycles (
  id bigint generated always as identity primary key,
  cycle_date timestamptz not null default now(),
  actual_bill numeric not null,
  calculated_total numeric not null,
  total_misc numeric not null default 0,
  line_loss numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists cycle_business_bills (
  id bigint generated always as identity primary key,
  cycle_id bigint not null references billing_cycles(id) on delete cascade,
  business_id integer not null,
  business_name text not null,
  previous_reading numeric not null,
  current_reading numeric not null,
  units numeric not null,
  unit_amount numeric not null,
  misc numeric not null default 0,
  line_loss_share numeric not null default 0,
  final_amount numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cycle_business_bills_cycle_id
  on cycle_business_bills (cycle_id);

-- If Row Level Security is enabled on your `businesses` table, mirror the
-- same policies here so the app (using the anon key) can read/write these
-- two tables too. Example — permissive policy matching typical anon-key setups:
--
-- alter table billing_cycles enable row level security;
-- alter table cycle_business_bills enable row level security;
--
-- create policy "Allow all for anon" on billing_cycles
--   for all using (true) with check (true);
-- create policy "Allow all for anon" on cycle_business_bills
--   for all using (true) with check (true);
--
-- Only add these permissive policies if your `businesses` table currently
-- has similarly open access — check Supabase Dashboard → Authentication →
-- Policies first.
