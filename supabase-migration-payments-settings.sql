-- Payment status per tenant bill + per-complex admin settings.

alter table cycle_business_bills
  add column if not exists payment_status text not null default 'awaiting',
  add column if not exists amount_paid numeric;

alter table complexes
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number text,
  add column if not exists rate_per_unit numeric not null default 250,
  add column if not exists banner_text text,
  add column if not exists banner_enabled boolean not null default false;
