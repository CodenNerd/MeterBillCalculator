-- Add published_at for cycle ordering (cycle_date primary, published_at secondary).
alter table billing_cycles
  add column if not exists published_at timestamptz;

-- Backfill: treat create time as first publish for existing rows.
update billing_cycles
set published_at = created_at
where published_at is null
  and (status = 'published' or status = 'concluded' or status is null);

create index if not exists idx_billing_cycles_complex_order
  on billing_cycles (complex_id, cycle_date desc, published_at desc nulls last);
