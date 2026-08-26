-- Fix previous_reading on open published cycles by walking back to the
-- nearest older cycle that has a bill for the same business_id.
-- (Handles shops missing from an immediate predecessor after delete/restore.)

with ordered_cycles as (
  select
    id,
    complex_id,
    row_number() over (
      partition by complex_id
      order by
        cycle_date asc,
        published_at asc nulls last,
        created_at asc,
        id asc
    ) as rn
  from billing_cycles
),
bill_with_prev as (
  select
    b.id as bill_id,
    b.previous_reading as old_prev,
    b.current_reading,
    b.units as old_units,
    b.unit_amount as old_unit_amount,
    b.misc,
    b.line_loss_share,
    (
      select p.current_reading
      from cycle_business_bills p
      join ordered_cycles op
        on op.id = p.cycle_id
       and op.complex_id = o.complex_id
      where p.business_id = b.business_id
        and op.rn < o.rn
      order by op.rn desc
      limit 1
    ) as chained_prev
  from cycle_business_bills b
  join ordered_cycles o on o.id = b.cycle_id
  join billing_cycles c on c.id = b.cycle_id
  where c.status = 'published'
)
update cycle_business_bills b
set
  previous_reading = bp.chained_prev,
  units = greatest(0, b.current_reading - bp.chained_prev),
  unit_amount = case
    when bp.old_units > 0 then
      round((bp.old_unit_amount / bp.old_units) * greatest(0, b.current_reading - bp.chained_prev), 2)
    else b.unit_amount
  end,
  final_amount = case
    when bp.old_units > 0 then
      round((bp.old_unit_amount / bp.old_units) * greatest(0, b.current_reading - bp.chained_prev), 2)
      + coalesce(b.misc, 0)
      + coalesce(b.line_loss_share, 0)
    else b.final_amount
  end
from bill_with_prev bp
where b.id = bp.bill_id
  and bp.chained_prev is not null
  and b.previous_reading is distinct from bp.chained_prev;
