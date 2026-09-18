-- Restore an account stuck in `deletion_requested`.
--
-- `request_account_deletion` (002) only flags the profile; it never touches
-- `auth.users`. Before `101_cancel_account_deletion.sql` there was no way back,
-- so an account that requested deletion could neither use the app
-- (`assert_discovery_caller_eligible` requires `active`) nor re-register (the
-- e-mail is still taken). This is the manual repair for accounts stranded that
-- way on an environment where `101` is not yet deployed.
--
-- Run in the Supabase SQL editor for the target project. Read-only check first.
-- Replace the address on every line.

-- 1. LOOK FIRST. Confirm exactly one row, and that it is the account you mean.
select
  u.id,
  u.email,
  p.display_name,
  p.account_status,
  p.deletion_requested_at,
  u.created_at
from auth.users as u
join public.profiles as p on p.id = u.id
where lower(u.email) = lower('aly.moghnieh@gmail.com');

-- If this returns MORE THAN ONE ROW, stop and read the note at the bottom:
-- duplicate accounts are their own problem and this script is not the fix.

-- 2. Restore. Scoped by e-mail and by current status, so it cannot touch an
--    account that is merely suspended, and cannot run twice.
update public.profiles as p
set
  account_status = 'active',
  deletion_requested_at = null
from auth.users as u
where u.id = p.id
  and lower(u.email) = lower('aly.moghnieh@gmail.com')
  and p.account_status = 'deletion_requested';

-- 3. Record why the status changed. The request is already audited; without
--    this the reversal is not, and the trail reads as though nothing happened.
insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
select
  p.id,
  'account_deletion_cancelled',
  'profile',
  p.id,
  jsonb_build_object(
    'reason', 'manual repair: no self-service exit before migration 101',
    'performed_by', 'operator'
  )
from public.profiles as p
join auth.users as u on u.id = p.id
where lower(u.email) = lower('aly.moghnieh@gmail.com')
  and p.account_status = 'active';

-- 4. Verify.
select p.account_status, p.deletion_requested_at
from public.profiles as p
join auth.users as u on u.id = p.id
where lower(u.email) = lower('aly.moghnieh@gmail.com');
-- Expect: active, null.

-- ---------------------------------------------------------------------------
-- If step 1 returned more than one row
-- ---------------------------------------------------------------------------
-- That is the duplicate-account case the 2026-09-11 decision flagged when
-- Google sign-in was added beside the magic link, and again on 2026-09-12 with
-- email+password. Two sign-in doors, one person, two `auth.users` rows -- which
-- is also why a player can appear in their own Home carousel: the self-exclusion
-- in `discover_compatible_players` compares user ids, and duplicates are
-- different ids.
--
-- Do not merge them with SQL. Ratings, match history and participation all key
-- on the auth user id, so a merge is a data migration, not an update. Decide
-- which account is the real one, and handle the other deliberately.
