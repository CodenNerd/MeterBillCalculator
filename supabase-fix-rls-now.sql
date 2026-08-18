-- Run this FIRST — it only enables RLS and (re)creates policies, nothing
-- risky, safe to run multiple times. This closes the security hole
-- regardless of what happened with the rest of the earlier migration.

alter table complexes enable row level security;
alter table businesses enable row level security;
alter table billing_cycles enable row level security;
alter table cycle_business_bills enable row level security;

-- complexes
drop policy if exists "owner can read own complex" on complexes;
create policy "owner can read own complex" on complexes
  for select using (owner_id = auth.uid());

drop policy if exists "owner can update own complex" on complexes;
create policy "owner can update own complex" on complexes
  for update using (owner_id = auth.uid());

drop policy if exists "user can create their own complex" on complexes;
create policy "user can create their own complex" on complexes
  for insert with check (owner_id = auth.uid());

-- businesses
drop policy if exists "admin manages own complex businesses" on businesses;
create policy "admin manages own complex businesses" on businesses
  for all using (
    complex_id in (select id from complexes where owner_id = auth.uid())
  ) with check (
    complex_id in (select id from complexes where owner_id = auth.uid())
  );

drop policy if exists "business owner reads own row" on businesses;
create policy "business owner reads own row" on businesses
  for select using (owner_user_id = auth.uid());

drop policy if exists "business owner claims own row" on businesses;
create policy "business owner claims own row" on businesses
  for update using (email = auth.email() and owner_user_id is null)
  with check (owner_user_id = auth.uid());

-- billing_cycles
drop policy if exists "admin manages own complex cycles" on billing_cycles;
create policy "admin manages own complex cycles" on billing_cycles
  for all using (
    complex_id in (select id from complexes where owner_id = auth.uid())
  ) with check (
    complex_id in (select id from complexes where owner_id = auth.uid())
  );

-- cycle_business_bills
drop policy if exists "admin manages own complex cycle bills" on cycle_business_bills;
create policy "admin manages own complex cycle bills" on cycle_business_bills
  for all using (
    complex_id in (select id from complexes where owner_id = auth.uid())
  ) with check (
    complex_id in (select id from complexes where owner_id = auth.uid())
  );

drop policy if exists "business owner reads own bill history" on cycle_business_bills;
create policy "business owner reads own bill history" on cycle_business_bills
  for select using (
    business_id in (select id from businesses where owner_user_id = auth.uid())
  );

-- Sanity check — every row here should show rowsecurity = true.
-- If any say false, that table still isn't protected — tell me which one.
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in ('complexes', 'businesses', 'billing_cycles', 'cycle_business_bills');
