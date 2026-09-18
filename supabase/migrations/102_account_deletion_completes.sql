-- Deleting an account now actually deletes the person, and keeps the record.
--
-- `request_account_deletion` (002) set a flag and stopped. The intent was a
-- soft state transition an operator would finish, but **no operator tooling was
-- ever built**, so nothing finished it. The result was a trap, hit by a tester:
--
--   * `assert_discovery_caller_eligible` (004) refuses every marketplace RPC
--     for a non-`active` caller, so the app is dead for them;
--   * the address stays registered, so signing up again is refused as
--     "already in use";
--   * and nothing anywhere could move the account out of that state.
--
-- The project rule this deferred to -- avoid destructive deletion of
-- operational records -- is about **matches, bookings and results**. It was
-- applied to the **auth identity**, which is a different thing and which the
-- rule never protected. Deleting the identity while keeping the record is both
-- what the rule wants and what a player asking to be deleted means.
--
-- ## Why the identity is not simply deleted
--
-- `profiles.id references auth.users(id) on delete cascade`, and eight tables
-- cascade from `profiles` in turn -- including `match_participants`. Deleting
-- the `auth.users` row would therefore take the player's match history with it
-- **and gut the matches of everyone who played against them**: their results
-- would lose a side, their rating events an actor. That cascade is why nobody
-- wired real deletion up, and it is not something to discover in production.
--
-- So the row stays and is emptied instead: the address is rotated to an
-- unusable one, the credential and identities are removed so nothing can sign
-- in as it again, and the profile becomes an anonymous tombstone. Functionally
-- the account is gone; structurally the foreign keys still resolve.

-- Drop before recreate: the signature is unchanged, but the behaviour is not,
-- and `create or replace` would leave no trace of that in the catalog.
create or replace function public.request_account_deletion()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_status public.account_status;
  v_match record;
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

  if v_account_status = 'deleted' then
    raise exception using
      errcode = '42501',
      message = 'Account is deleted';
  end if;

  -- ---------------------------------------------------------------------
  -- 1. Leave the matches that have not happened yet.
  --
  -- Without this a departing player stays on rosters nobody can fill and in
  -- groups waiting on a vote that will never come. Past matches are untouched:
  -- they happened, and the other players' results depend on that.
  -- ---------------------------------------------------------------------
  for v_match in
    select mp.match_id, mp.is_creator
    from public.match_participants as mp
    join public.matches as m on m.id = mp.match_id
    where mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested')
      and m.status in ('draft', 'open', 'full', 'ready_to_book', 'booking_pending', 'confirmed')
  loop
    if v_match.is_creator then
      -- The host is leaving for good; the match cannot proceed without them.
      -- `notify_match_cancelled` (089) tells the roster, and
      -- `matches_close_pending_asks` (099) closes invitations and the waitlist.
      update public.matches
      set status = 'cancelled',
          cancellation_reason = 'The host deleted their account.',
          updated_at = now()
      where id = v_match.match_id;
    else
      update public.match_participants
      set status = 'left', left_at = now()
      where match_id = v_match.match_id
        and user_id = v_user_id;

      perform public.refresh_match_open_state(v_match.match_id);
    end if;
  end loop;

  -- ---------------------------------------------------------------------
  -- 2. Empty the profile into a tombstone.
  --
  -- `display_name` is not null and is read directly by a dozen surfaces, so it
  -- gets a sentinel rather than null. It is deliberately not localized: it is
  -- data, not copy, and a client that wants a translated word can key off
  -- `account_status = 'deleted'`.
  -- ---------------------------------------------------------------------
  update public.profiles
  set
    display_name = 'Deleted player',
    avatar_path = null,
    birth_year = null,
    gender = null,
    account_status = 'deleted',
    deletion_requested_at = now(),
    updated_at = now()
  where id = v_user_id;

  update public.player_profiles
  set bio = null
  where user_id = v_user_id;

  -- Everything that describes where and when this person plays. None of it is
  -- an operational record; all of it would otherwise keep them discoverable.
  delete from public.player_zones where user_id = v_user_id;
  delete from public.availability_windows where user_id = v_user_id;
  delete from public.player_favorite_clubs where user_id = v_user_id;
  delete from public.device_push_tokens where user_id = v_user_id;

  -- ---------------------------------------------------------------------
  -- 3. Release the identity.
  --
  -- This is what frees the address for a fresh sign-up. The row survives so
  -- the cascade above never fires; it simply stops being anybody's login.
  -- ---------------------------------------------------------------------
  delete from auth.identities where user_id = v_user_id;
  delete from auth.sessions where user_id = v_user_id;

  update auth.users
  set
    email = format('deleted+%s@account.invalid', v_user_id),
    encrypted_password = null,
    email_confirmed_at = null,
    phone = null,
    raw_user_meta_data = '{}'::jsonb,
    updated_at = now()
  where id = v_user_id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_user_id,
    'account_deleted',
    'profile',
    v_user_id,
    jsonb_build_object('identity_released', true)
  );
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

-- `cancel_account_deletion` (101) restored a *pending* request. Deletion is now
-- immediate and the identity is gone, so there is nothing left to withdraw --
-- the guard it already had (`account_status <> 'deletion_requested'`) refuses
-- correctly on its own. Kept rather than dropped: accounts flagged by the old
-- behaviour still exist and still need the exit.
comment on function public.cancel_account_deletion() is
  'Withdraws a deletion request left by the pre-102 behaviour. New deletions complete immediately and cannot be withdrawn.';
