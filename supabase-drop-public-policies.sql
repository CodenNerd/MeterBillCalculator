-- These four are leftover from before auth existed — "true" means anyone
-- can do anything, which is exactly what's cancelling out your new scoped
-- policies. Safe to drop: your app never relies on public/anon access
-- anymore, everything goes through the "admin manages own complex
-- businesses" / "business owner..." policies instead.

drop policy if exists "Public delete" on businesses;
drop policy if exists "Public insert" on businesses;
drop policy if exists "Public read" on businesses;
drop policy if exists "Public update" on businesses;

-- Confirm only the intended policies remain:
select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'businesses';
