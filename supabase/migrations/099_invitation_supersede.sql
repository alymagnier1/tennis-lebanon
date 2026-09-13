-- A seat being taken suspends an invitation instead of ending it.
--
-- A host invites three players for one seat. Whichever of them takes it, the
-- other two were handled by two different mechanisms that disagreed:
--
--   * filled by an **invite acceptance** -> `apply_match_invitation_acceptance`
--     called `revoke_pending_targeted_invites` (010:126), stamping `revoked_at`
--     on every other pending invitation. Dead permanently, no notification.
--   * filled by **`join_match`** or an approved request -> that call never ran.
--     The invitations kept `revoked_at is null` and were hidden only by the
--     `participant_count < capacity` filter in `list_my_match_invites`
--     (088:299).
--
-- The two paths then diverged again when somebody left. Path A's invitations
-- stayed dead and the host was never prompted to re-invite; path B's
-- **silently reappeared** in three inboxes days later, host's note still
-- attached, for a match those players had written off.
--
-- `superseded_at` is the fix: a reversible state meaning "the seat went to
-- somebody else". Both calls move into `refresh_match_open_state`, which is
-- already the sole owner of the roster-to-status mapping and already runs on
-- every join, leave, invite-accept, withdraw and booking path -- so the two
-- fill paths become identical *by construction* rather than by remembering to
-- call the same helper from each. That forgetting is what caused this.
--
-- Suspension is roster-driven, so it sits above the timing-mode branching:
-- both branches return early, and the rule depends only on count vs capacity.
--
-- Termination -- as opposed to suspension -- is status-driven and lives in the
-- new `matches_close_pending_asks` trigger, because `refresh_match_open_state`
-- returns early for exactly the statuses that terminate.

alter table public.match_invitations
  add column if not exists superseded_at timestamptz;

comment on column public.match_invitations.superseded_at is
  'Set while the roster is full and cleared when a seat reopens. The one non-terminal state: `revoked_at`, `declined_at` and `accepted_at` all end an invitation, this one only pauses it.';

-- Suspend every invitation still waiting on this match.
--
-- No `p_except_invitation_id`, unlike the function this replaces:
-- `apply_match_invitation_acceptance` stamps `accepted_at` before it refreshes
-- state, so `accepted_at is null` already excludes the accepting invitation.
create or replace function public.supersede_pending_invites(p_match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invite record;
begin
  for v_invite in
    update public.match_invitations as mi
    set superseded_at = now()
    where mi.match_id = p_match_id
      and mi.invited_user_id is not null
      and mi.superseded_at is null
      and mi.revoked_at is null
      and mi.accepted_at is null
      and mi.declined_at is null
      and mi.expires_at > now()
    returning mi.id, mi.invited_user_id
  loop
    -- Points at Discover, not at the hub: the hub is a match they cannot join,
    -- and on an invite-only one `get_match_hub` would refuse them outright.
    -- The job here is to turn a dead end into a second search.
    perform public.enqueue_notification(
      v_invite.invited_user_id,
      'match_invitation_superseded',
      'match',
      p_match_id,
      format('match_invitation_superseded:%s', v_invite.id),
      jsonb_build_object('deepLink', '/discover'),
      now()
    );
  end loop;
end;
$$;

revoke all on function public.supersede_pending_invites(uuid) from public, anon, authenticated;

-- Bring back only invitations that are still genuinely acceptable.
--
-- The extra conditions are not paranoia. A restored invitation used to be able
-- to point at a match whose time options had all passed: `list_my_match_invites`
-- never filtered on one existing, so the card rendered with a null
-- `soonest_time` and accepting it then failed `assert_joinable_match` with
-- `match_has_no_future_times` behind the generic error.
create or replace function public.restore_superseded_invites(p_match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_bucket bigint;
begin
  if not exists (
    select 1
    from public.match_time_options as mto
    where mto.match_id = p_match_id
      and mto.withdrawn_at is null
      and mto.ends_at > now()
  ) then
    return;
  end if;

  -- Same 15-minute bucket the roster trigger uses. A match that fills and
  -- empties repeatedly collapses to one notification per kind, which makes a
  -- flapping roster noisy rather than abusive -- the call `092` made for
  -- withdraw-and-re-request.
  v_bucket := floor(extract(epoch from now()) / 900)::bigint;

  for v_invite in
    update public.match_invitations as mi
    set superseded_at = null
    where mi.match_id = p_match_id
      and mi.superseded_at is not null
      and mi.revoked_at is null
      and mi.accepted_at is null
      and mi.declined_at is null
      and mi.expires_at > now()
    returning mi.id, mi.invited_user_id
  loop
    perform public.enqueue_notification(
      v_invite.invited_user_id,
      'match_seat_reopened',
      'match',
      p_match_id,
      format('match_seat_reopened:%s:%s', v_invite.id, v_bucket),
      jsonb_build_object('deepLink', format('/match/%s', p_match_id)),
      now()
    );
  end loop;
end;
$$;

revoke all on function public.restore_superseded_invites(uuid) from public, anon, authenticated;

-- `047`'s body, with suspension added above the timing-mode branching.
create or replace function public.refresh_match_open_state(p_match_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
begin
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    return;
  end if;

  if v_match.status not in ('open', 'full', 'ready_to_book') then
    return;
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_match_id);

  -- Before the branching, deliberately. Both branches below return early, and
  -- suspension depends only on roster versus capacity -- not on which status
  -- that produces. `ready_to_book` needs no case of its own:
  -- `refresh_match_time_agreement` (033) requires a full roster before it, so
  -- it is already covered by `v_count >= v_capacity`.
  if v_count >= v_capacity then
    perform public.supersede_pending_invites(p_match_id);
  else
    perform public.restore_superseded_invites(p_match_id);
  end if;

  if v_match.timing_mode = 'fixed' then
    -- Joining is consent, so a full roster is immediately bookable. The agreed
    -- time is a property of the match and survives someone leaving.
    if v_count >= v_capacity
       and v_match.selected_time_option_id is not null
       and public.match_has_accepted_court(p_match_id) then
      -- Court-first: the court was secured while the match was still
      -- recruiting, so filling the roster is what completes it.
      update public.matches
      set status = 'confirmed', updated_at = now()
      where id = p_match_id
        and status in ('open', 'full', 'ready_to_book');
    elsif v_count >= v_capacity and v_match.selected_time_option_id is not null then
      update public.matches
      set status = 'ready_to_book', updated_at = now()
      where id = p_match_id
        and status in ('open', 'full');
    elsif v_count >= v_capacity then
      update public.matches
      set status = 'full', updated_at = now()
      where id = p_match_id
        and status = 'open';
    else
      update public.matches
      set status = 'open', updated_at = now()
      where id = p_match_id
        and status in ('full', 'ready_to_book');
    end if;

    return;
  end if;

  -- A real court outranks the poll. Recording a court at an hour the club
  -- actually had withdraws the option the group voted on, and without this the
  -- vote check below would immediately undo the confirmation.
  if v_count >= v_capacity and public.match_has_accepted_court(p_match_id) then
    update public.matches
    set status = 'confirmed', updated_at = now()
    where id = p_match_id
      and status in ('open', 'full', 'ready_to_book');

    return;
  end if;

  if v_count >= v_capacity then
    update public.matches
    set status = 'full', updated_at = now()
    where id = p_match_id
      and status = 'open';
  elsif v_count < v_capacity then
    update public.matches
    set
      status = 'open',
      selected_time_option_id = null,
      updated_at = now()
    where id = p_match_id
      and status in ('full', 'ready_to_book');
  end if;

  perform public.refresh_match_time_agreement(p_match_id);
end;
$$;

-- `010`'s body without the trailing revoke: `refresh_match_open_state` now owns
-- that decision, and owning it in one place is the entire point of this change.
create or replace function public.apply_match_invitation_acceptance(
  p_invite public.match_invitations,
  p_user_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
  v_status public.participant_status;
begin
  -- A superseded invitation is not acceptable while it is suspended; the seat
  -- it was for is taken. It becomes acceptable again when one reopens.
  if p_invite.revoked_at is not null
     or p_invite.accepted_at is not null
     or p_invite.superseded_at is not null
     or p_invite.expires_at <= now() then
    raise exception using errcode = 'P0002', message = 'Invite not found or expired';
  end if;

  if p_invite.invited_user_id is not null
     and p_invite.invited_user_id <> p_user_id then
    raise exception using errcode = '42501', message = 'Invite is for another user';
  end if;

  v_match := public.assert_joinable_match(p_invite.match_id, p_user_id, true);

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_invite.match_id
      and mp.user_id = p_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'already_participant';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_invite.match_id);

  if v_count >= v_capacity then
    raise exception using errcode = 'P0001', message = 'match_full';
  end if;

  v_status := 'accepted';

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_invite.match_id
      and mp.user_id = p_user_id
      and mp.status in ('left', 'declined', 'removed')
  ) then
    update public.match_participants
    set
      status = v_status,
      joined_at = now(),
      left_at = null
    where match_id = p_invite.match_id
      and user_id = p_user_id;
  else
    insert into public.match_participants (
      match_id,
      user_id,
      status,
      is_creator,
      joined_at
    )
    values (
      p_invite.match_id,
      p_user_id,
      v_status,
      false,
      now()
    );
  end if;

  -- Before the refresh, so `accepted_at is null` excludes this invitation from
  -- the suspension sweep that refresh may trigger.
  update public.match_invitations
  set accepted_at = now()
  where id = p_invite.id;

  perform public.refresh_match_open_state(p_invite.match_id);

  return p_invite.match_id;
end;
$$;

drop function if exists public.revoke_pending_targeted_invites(uuid, uuid);

-- Close out everything still waiting when a match leaves the recruiting set.
--
-- A sibling of `matches_notify_cancelled` (089) rather than an edit to it: that
-- one is about notifying, this one is about state. Both are triggers for the
-- reason the 2026-08-21 entry gives -- `cancel_match` is not the only writer of
-- these statuses, so a call placed inside one RPC misses every other path.
--
-- Waitlisted requests go to `declined`, which fires the existing
-- `requested -> declined` branch of `notify_match_roster_change` and therefore
-- the existing `match_request_declined` kind. No new kind for the waitlist.
create or replace function public.close_match_pending_asks()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.status in ('draft', 'open', 'full', 'ready_to_book')
     or old.status not in ('draft', 'open', 'full', 'ready_to_book') then
    return null;
  end if;

  update public.match_invitations
  set revoked_at = now()
  where match_id = new.id
    and revoked_at is null
    and accepted_at is null;

  update public.match_participants
  set status = 'declined'
  where match_id = new.id
    and status = 'requested';

  return null;
end;
$$;

drop trigger if exists matches_close_pending_asks on public.matches;

create trigger matches_close_pending_asks
  after update on public.matches
  for each row execute function public.close_match_pending_asks();

-- `088`'s body plus the two filters a restored invitation needs: not suspended,
-- and on a match that still has an hour left to play.
create or replace function public.list_my_match_invites()
returns setof public.match_invite_inbox_row
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  return query
  select
    mi.id,
    m.id,
    m.format,
    m.status,
    creator_profile.display_name,
    inviter_profile.display_name,
    public.match_participant_count(m.id),
    public.match_capacity_for_format(m.format),
    (
      select min(mto.starts_at)
      from public.match_time_options as mto
      where mto.match_id = m.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ),
    mi.expires_at,
    mi.created_at,
    mi.note
  from public.match_invitations as mi
  join public.matches as m on m.id = mi.match_id
  join public.profiles as creator_profile on creator_profile.id = m.creator_id
  join public.profiles as inviter_profile on inviter_profile.id = mi.created_by
  where mi.invited_user_id = v_user_id
    and mi.revoked_at is null
    and mi.accepted_at is null
    and mi.superseded_at is null
    and mi.expires_at > now()
    and m.status in ('open', 'full')
    and public.match_participant_count(m.id)
      < public.match_capacity_for_format(m.format)
    and exists (
      select 1
      from public.match_time_options as mto
      where mto.match_id = m.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    )
    and not exists (
      select 1
      from public.match_participants as mp
      where mp.match_id = m.id
        and mp.user_id = v_user_id
        and mp.status in ('accepted', 'requested', 'invited')
    )
  order by mi.created_at desc;
end;
$$;

revoke all on function public.list_my_match_invites() from public, anon;
grant execute on function public.list_my_match_invites() to authenticated;
