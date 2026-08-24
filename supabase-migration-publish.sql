-- Run when connecting a real Supabase project.
-- Cycle publish/conclude fields + payment evidence metadata.

alter table billing_cycles
  add column if not exists name text,
  add column if not exists status text not null default 'concluded',
  add column if not exists allocation_method text not null default 'equal';

alter table cycle_business_bills
  add column if not exists evidence_note text,
  add column if not exists evidence_file_id text,
  add column if not exists misc_note text;
