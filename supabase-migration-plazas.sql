-- Multitenant plazas: slug URLs + superadmin provisioning.
-- Run in Supabase SQL Editor after prior migrations.

-- Slug + invite email on complexes
alter table complexes
  add column if not exists slug text,
  add column if not exists owner_email text;

-- Allow unclaimed plazas (superadmin creates before admin signs up)
alter table complexes alter column owner_id drop not null;

-- Backfill slugs from names
update complexes
set slug = lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
where slug is null or slug = '';

update complexes set slug = 'plaza-' || substr(id::text, 1, 8)
where slug is null or slug = '';

-- Deduplicate slugs by appending short id for non-first duplicates
update complexes c
set slug = c.slug || '-' || substr(c.id::text, 1, 6)
where exists (
  select 1 from complexes o
  where o.slug = c.slug and o.created_at < c.created_at
);

alter table complexes alter column slug set not null;

create unique index if not exists idx_complexes_slug on complexes (slug);

-- Public can resolve plaza by slug (needed for shared URLs / invoices)
drop policy if exists "anyone can read complexes" on complexes;
create policy "anyone can read complexes" on complexes
  for select using (true);

-- Superadmin full access (role in user_metadata)
drop policy if exists "superadmin manages complexes" on complexes;
create policy "superadmin manages complexes" on complexes
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin');

-- Keep owner update; invitee can claim unowned plaza
drop policy if exists "invitee can claim plaza" on complexes;
create policy "invitee can claim plaza" on complexes
  for update
  using (
    owner_id is null
    and owner_email is not null
    and lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (owner_id = auth.uid());

-- Plaza creation is superadmin-only going forward. Drop open self-insert if present
drop policy if exists "user can create their own complex" on complexes;
