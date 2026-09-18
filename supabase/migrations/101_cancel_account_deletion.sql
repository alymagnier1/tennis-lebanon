-- A deletion request was a one-way door with nothing on the other side.
--
-- `request_account_deletion` (002) sets `account_status = 'deletion_requested'`
-- and stops there, deliberately: the 2026 soft-state rule forbids destructive
-- deletion of operational records, so the `auth.users` row and the profile both
-- survive until an operator actions them. That part is right.
--
-- What was missing is any way out. Nothing in any migration sets
-- `account_status` back to `active`, and there is no operator tooling to finish
-- the deletion either. So a player who tapped it once was left in a state where:
--
--   * `assert_discovery_caller_eligible` (004) refuses every marketplace RPC,
--     because it requires `active` -- the app is effectively dead for them;
--   * the e-mail stays registered in `auth.users`, so signing up again is
--     refused with "already in use";
--   * and the only screen they can reach offers Contact support and Sign out.
--
-- Found when a tester requested deletion, tried to sign up with the same
-- address, and could neither return nor start over.
--
-- Restoring is the player's own decision about their own account, so it needs
-- no operator. The audit row is kept rather than deleted: that a request was
-- made and withdrawn is exactly the kind of thing the audit trail exists for.

-- Deliberately does **not** call `assert_marketplace_caller`. That helper
-- requires `account_status = 'active'`, which is precisely the condition this
-- function exists to repair -- routing it through there would make the exit
-- reachable only by accounts that do not need it. `auth.uid()` directly, the
-- same shape `request_account_deletion` uses.
create or replace function public.cancel_account_deletion()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_status public.account_status;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select p.account_status
  into v_account_status
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Profile not found';
  end if;

  -- Only a pending request can be withdrawn. `suspended` is a moderation
  -- decision and is not the account holder's to undo; `deleted` is terminal.
  -- Nothing writes `deleted` today, but the guard states the rule rather than
  -- relying on that staying true.
  if v_account_status <> 'deletion_requested' then
    raise exception using
      errcode = 'P0001',
      message = 'no_pending_deletion';
  end if;

  update public.profiles
  set
    account_status = 'active',
    deletion_requested_at = null
  where id = v_user_id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id
  )
  values (
    v_user_id,
    'account_deletion_cancelled',
    'profile',
    v_user_id
  );
end;
$$;

revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;
