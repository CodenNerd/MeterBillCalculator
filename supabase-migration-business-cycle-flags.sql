-- Soft-archive businesses + per-cycle exclude-from-offset flag.
alter table businesses
  add column if not exists archived_at timestamptz;

create index if not exists idx_businesses_complex_active
  on businesses (complex_id)
  where archived_at is null;

alter table cycle_business_bills
  add column if not exists exclude_from_offset boolean not null default false;
