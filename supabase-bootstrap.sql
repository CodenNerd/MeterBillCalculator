-- MeterCalc full schema for a fresh Supabase project.
-- Safe to re-run (IF NOT EXISTS / drop policy if exists).
-- Order: core tables → auth/RLS → publish/allocation → plazas → payments/settings → public reads.

-- Superadmin helper (JWT claim + auth.users fallback)
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin',
    false
  )
  or exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and (u.raw_user_meta_data ->> 'role') = 'superadmin'
  );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated, anon;

-- ============================================================
-- 1. Core tables
-- ============================================================

create table if not exists complexes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  slug text,
  owner_email text,
  bank_name text,
  account_name text,
  account_number text,
  rate_per_unit numeric not null default 250,
  banner_text text,
  banner_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists businesses (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  previous_reading numeric not null default 0,
  complex_id uuid references complexes(id) on delete cascade,
  owner_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists billing_cycles (
  id bigint generated always as identity primary key,
  cycle_date timestamptz not null default now(),
  actual_bill numeric not null,
  calculated_total numeric not null,
  total_misc numeric not null default 0,
  line_loss numeric not null,
  complex_id uuid references complexes(id) on delete cascade,
  name text,
  status text not null default 'concluded',
  allocation_method text not null default 'equal',
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
  complex_id uuid references complexes(id) on delete cascade,
  evidence_note text,
  evidence_file_id text,
  misc_note text,
  payment_status text not null default 'awaiting',
  amount_paid numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_cycle_business_bills_cycle_id
  on cycle_business_bills (cycle_id);

create unique index if not exists idx_businesses_complex_email
  on businesses (complex_id, email) where email is not null;

-- ============================================================
-- 2. Additive columns (idempotent for older DBs)
-- ============================================================

alter table complexes
  add column if not exists slug text,
  add column if not exists owner_email text,
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number text,
  add column if not exists rate_per_unit numeric,
  add column if not exists banner_text text,
  add column if not exists banner_enabled boolean;

alter table complexes alter column rate_per_unit set default 250;
update complexes set rate_per_unit = 250 where rate_per_unit is null;
alter table complexes alter column rate_per_unit set not null;

alter table complexes alter column banner_enabled set default false;
update complexes set banner_enabled = false where banner_enabled is null;
alter table complexes alter column banner_enabled set not null;

-- Allow unclaimed plazas (superadmin provisions before admin signs in)
do $$
begin
  alter table complexes alter column owner_id drop not null;
exception when others then
  null;
end $$;

alter table businesses
  add column if not exists complex_id uuid references complexes(id) on delete cascade,
  add column if not exists email text,
  add column if not exists owner_user_id uuid references auth.users(id),
  add column if not exists previous_reading numeric;

alter table businesses alter column previous_reading set default 0;
update businesses set previous_reading = 0 where previous_reading is null;
alter table businesses alter column previous_reading set not null;

alter table billing_cycles
  add column if not exists complex_id uuid references complexes(id) on delete cascade,
  add column if not exists name text,
  add column if not exists status text,
  add column if not exists allocation_method text;

alter table billing_cycles alter column status set default 'concluded';
update billing_cycles set status = 'concluded' where status is null;
alter table billing_cycles alter column status set not null;

alter table billing_cycles alter column allocation_method set default 'equal';
update billing_cycles set allocation_method = 'equal' where allocation_method is null;
alter table billing_cycles alter column allocation_method set not null;

alter table cycle_business_bills
  add column if not exists complex_id uuid references complexes(id) on delete cascade,
  add column if not exists evidence_note text,
  add column if not exists evidence_file_id text,
  add column if not exists misc_note text,
  add column if not exists payment_status text,
  add column if not exists amount_paid numeric;

alter table cycle_business_bills alter column payment_status set default 'awaiting';
update cycle_business_bills set payment_status = 'awaiting' where payment_status is null;
alter table cycle_business_bills alter column payment_status set not null;

-- Backfill slugs
update complexes
set slug = lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
where slug is null or slug = '';

update complexes set slug = 'plaza-' || substr(id::text, 1, 8)
where slug is null or slug = '';

update complexes c
set slug = c.slug || '-' || substr(c.id::text, 1, 6)
where exists (
  select 1 from complexes o
  where o.slug = c.slug and o.created_at < c.created_at
);

alter table complexes alter column slug set not null;
create unique index if not exists idx_complexes_slug on complexes (slug);

-- ============================================================
-- 3. RLS
-- ============================================================

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

drop policy if exists "anyone can read complexes" on complexes;
create policy "anyone can read complexes" on complexes
  for select using (true);

drop policy if exists "superadmin manages complexes" on complexes;
create policy "superadmin manages complexes" on complexes
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "invitee can claim plaza" on complexes;
create policy "invitee can claim plaza" on complexes
  for update
  using (
    owner_id is null
    and owner_email is not null
    and lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (owner_id = auth.uid());

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

drop policy if exists "public can read businesses" on businesses;
create policy "public can read businesses" on businesses
  for select using (true);

drop policy if exists "superadmin manages businesses" on businesses;
create policy "superadmin manages businesses" on businesses
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- billing_cycles
drop policy if exists "admin manages own complex cycles" on billing_cycles;
create policy "admin manages own complex cycles" on billing_cycles
  for all using (
    complex_id in (select id from complexes where owner_id = auth.uid())
  ) with check (
    complex_id in (select id from complexes where owner_id = auth.uid())
  );

drop policy if exists "public can read published cycles" on billing_cycles;
create policy "public can read published cycles" on billing_cycles
  for select using (status in ('published', 'concluded'));

drop policy if exists "superadmin manages cycles" on billing_cycles;
create policy "superadmin manages cycles" on billing_cycles
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

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

drop policy if exists "public can read published cycle bills" on cycle_business_bills;
create policy "public can read published cycle bills" on cycle_business_bills
  for select using (
    cycle_id in (
      select id from billing_cycles where status in ('published', 'concluded')
    )
  );

drop policy if exists "superadmin manages cycle bills" on cycle_business_bills;
create policy "superadmin manages cycle bills" on cycle_business_bills
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());
