-- Run this in the SQL Editor and paste me the results — it'll show every
-- policy currently on `businesses`, including any old leftover one that's
-- still wide open (that's what's triggering the "Always True" warnings).

select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'businesses';
