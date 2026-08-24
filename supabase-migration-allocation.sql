-- Optional: run when connecting a real Supabase project.
-- Adds allocation_method to billing_cycles for equal vs proportional splits.

alter table billing_cycles
  add column if not exists allocation_method text not null default 'equal';
