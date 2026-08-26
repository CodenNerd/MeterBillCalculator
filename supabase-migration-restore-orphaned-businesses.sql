-- Recreate businesses that were hard-deleted but still appear in cycle bills.
-- Preserves original business_id so timeline/invoice URLs keep working.
-- previous_reading is taken from the latest cycle's current_reading for that shop.

insert into businesses (id, name, previous_reading, complex_id, archived_at)
overriding system value
select
  s.business_id,
  s.business_name,
  coalesce(s.current_reading, 0),
  s.complex_id,
  null
from (
  select distinct on (b.business_id)
    b.business_id,
    b.business_name,
    b.current_reading,
    coalesce(b.complex_id, c.complex_id) as complex_id
  from cycle_business_bills b
  left join billing_cycles c on c.id = b.cycle_id
  where not exists (
    select 1 from businesses x where x.id = b.business_id
  )
  and coalesce(b.complex_id, c.complex_id) is not null
  and nullif(trim(b.business_name), '') is not null
  order by
    b.business_id,
    c.cycle_date desc nulls last,
    c.published_at desc nulls last,
    c.created_at desc nulls last,
    b.id desc
) s;

-- Keep the identity sequence ahead of any restored ids.
select setval(
  pg_get_serial_sequence('public.businesses', 'id'),
  greatest(coalesce((select max(id) from businesses), 1), 1)
);
