-- Hosts can remove an accepted player before the match starts.
--
-- `participant_status` has carried `'removed'` since `001` without a writer.
-- 2026-09-13 left it that way on purpose: removal is a moderation surface, not
-- a convenience, and needed a reason, a notification, a rejoin rule, and a
-- guarantee it does not look like a no-show. Those rules are now set, so this
-- writes the enum for the first time.
--
-- Rejoin always goes through `requested`, even on an instant-join match. Being
-- removed is a host decision the player should not be able to undo by tapping
-- Join again.

alter table public.match_participants
  add column if not exists removed_reason text,
  add column if not exists removed_at timestamptz;

alter table public.match_participants
  drop constraint if exists match_participants_removed_consistency;

alter table public.match_participants
  add constraint match_participants_removed_consistency
  check (
    (
      status = 'removed'
      and removed_at is not null
      and removed_reason in (
        'match_requirements_mismatch',
        'player_requested_removal',
        'conduct_issue'
      )
    )
    or (
      status <> 'removed'
      and removed_at is null
      and removed_reason is null
    )
  );

create or replace function public.remove_match_participant(
  p_match_id uuid,
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_reason text;
  v_target public.match_participants%rowtype;
  v_starts_at timestamptz;
  v_booking public.bookings%rowtype;
  v_prior_status public.match_status;
begin
  v_user_id := public.assert_marketplace_caller();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if v_reason is null
     or v_reason not in (
       'match_requirements_mismatch',
       'player_requested_removal',
       'conduct_issue'
     ) then
    raise exception using errcode = 'P0001', message = 'invalid_removal_reason';
  end if;

  if p_user_id = v_user_id then
    raise exception using errcode = 'P0001', message = 'cannot_remove_self';
  end if;

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.creator_id <> v_user_id then
    raise exception using
      errcode = '42501',
      message = 'Only the creator can remove a participant';
  end if;

  if v_match.status in (
    'in_progress',
    'completed',
    'cancelled',
    'expired',
    'disputed'
  ) then
    raise exception using errcode = 'P0001', message = 'match_not_removable';
  end if;

  v_starts_at := public.match_agreed_starts_at(p_match_id);
  if v_starts_at is not null and v_starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'match_already_started';
  end if;

  select *
  into v_target
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = p_user_id
  for update;

  if not found or v_target.status <> 'accepted' or v_target.is_creator then
    raise exception using errcode = 'P0001', message = 'participant_not_accepted';
  end if;

  v_prior_status := v_match.status;

  update public.match_participants
  set
    status = 'removed',
    left_at = now(),
    removed_at = now(),
    removed_reason = v_reason
  where match_id = p_match_id
    and user_id = p_user_id;

  update public.match_invitations
  set revoked_at = now()
  where match_id = p_match_id
    and created_by = p_user_id
    and revoked_at is null;

  -- Same booking_pending trap as leave_match: a club holding a request for a
  -- now-short roster should not be able to accept it.
  if v_prior_status = 'booking_pending' then
    select *
    into v_booking
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status = 'requested'
    order by b.created_at desc
    limit 1;

    if found then
      update public.bookings
      set
        status = 'cancelled',
        acted_by = v_user_id,
        acted_at = now(),
        updated_at = now()
      where id = v_booking.id;

      perform public.append_booking_event(
        v_booking.id,
        'requested',
        'cancelled',
        v_user_id,
        'Host removed a participant before the club responded'
      );
    end if;

    update public.matches
    set status = 'ready_to_book', updated_at = now()
    where id = p_match_id
      and status = 'booking_pending';
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_user_id,
    'participant_removed',
    'match',
    p_match_id,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'reason', v_reason
    )
  );

  -- The roster trigger already tells everyone else a player left. This is the
  -- one message the removed player themselves need, and it is the only place
  -- the reason is shown.
  perform public.enqueue_notification(
    p_user_id,
    'match_participant_removed',
    'match',
    p_match_id,
    format('match_participant_removed:%s:%s', p_match_id, p_user_id),
    jsonb_build_object(
      'deepLink', '/matches',
      'title', 'You were removed from a match',
      'body', 'The host removed you. Open Matches to see the reason.',
      'params', jsonb_build_object('reason', v_reason)
    ),
    now()
  );

  perform public.refresh_match_open_state(p_match_id);
end;
$$;

revoke all on function public.remove_match_participant(uuid, uuid, text)
  from public, anon;
grant execute on function public.remove_match_participant(uuid, uuid, text)
  to authenticated;

create or replace function public.join_match(
  p_match_id uuid,
  p_note text default null
)
returns public.participant_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
  v_status public.participant_status;
  v_note text;
  v_was_removed boolean := false;
begin
  v_user_id := public.assert_marketplace_caller();
  v_match := public.assert_joinable_match(p_match_id, v_user_id, false);

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'already_participant';
  end if;

  select exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'removed'
  )
  into v_was_removed;

  if exists (
    select 1
    from public.viewer_agreed_time_conflicts_for(
      v_user_id,
      public.match_agreed_starts_at(p_match_id),
      public.match_agreed_ends_at(p_match_id),
      p_match_id
    )
  ) then
    raise exception using errcode = 'P0001', message = 'match_time_conflict';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_match_id);

  -- A host who removed this player must see the ask again. Instant-join would
  -- otherwise put them straight back on the roster, and a full instant-join
  -- would refuse them entirely instead of waitlisting like any other request.
  if v_was_removed or v_match.requires_creator_approval then
    v_status := 'requested';
    v_note := public.sanitize_player_note(p_note);
  else
    if v_count >= v_capacity then
      raise exception using errcode = 'P0001', message = 'match_full';
    end if;
    v_status := 'accepted';
    v_note := null;
  end if;

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status in ('left', 'declined', 'removed')
  ) then
    update public.match_participants
    set
      status = v_status,
      joined_at = case when v_status = 'accepted' then now() else null end,
      left_at = null,
      join_note = v_note,
      removed_at = null,
      removed_reason = null
    where match_id = p_match_id
      and user_id = v_user_id;
  else
    insert into public.match_participants (
      match_id,
      user_id,
      status,
      is_creator,
      joined_at,
      join_note
    )
    values (
      p_match_id,
      v_user_id,
      v_status,
      false,
      case when v_status = 'accepted' then now() else null end,
      v_note
    );
  end if;

  if v_status = 'accepted' then
    perform public.refresh_match_open_state(p_match_id);
  end if;

  return v_status;
end;
$$;
