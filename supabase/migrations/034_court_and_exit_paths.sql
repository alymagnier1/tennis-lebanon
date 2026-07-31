-- Milestone 8.11: close the remaining dead ends around courts and exits.
--
-- 1. A club in external_link (WhatsApp) mode could never produce a booking,
--    because request_match_booking rejects anything but manual_request. The
--    host phoned the club as they would anyway, played the match, and the app
--    still showed ready_to_book forever: no attendance, no result, no rating,
--    and the completion metric counted zero. confirm_external_court gives that
--    real-world path a way back into the product.
-- 2. ready_to_book never expired, so a match whose agreed time has long passed
--    sat in the list forever offering "book a court".
-- 3. A participant could neither leave nor withdraw while the club deliberated.
-- 4. One withdrawal from a booked doubles match cancelled it for the other
--    three and released the court.
-- 5. Two staff accepting overlapping requests produced a raw 23P01.

alter table public.bookings
  add column if not exists arranged_externally boolean not null default false;

comment on column public.bookings.arranged_externally is
  'True when the host secured the court directly with the club (for example over WhatsApp) rather than through the in-app queue.';

-- ---------------------------------------------------------------------------
-- 1. Externally arranged courts
-- ---------------------------------------------------------------------------

create or replace function public.confirm_external_court(
  p_match_id uuid,
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_court public.courts%rowtype;
  v_club public.clubs%rowtype;
  v_booking_id uuid;
  v_note text;
begin
  v_user_id := public.assert_marketplace_caller();
  v_note := nullif(trim(coalesce(p_note, '')), '');

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the match creator can confirm a court';
  end if;

  if v_match.status <> 'ready_to_book' then
    raise exception using errcode = 'P0001', message = 'Match is not ready to book';
  end if;

  perform public.assert_match_roster_full(p_match_id);

  if exists (
    select 1
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status in ('requested', 'alternative_proposed', 'accepted')
  ) then
    raise exception using errcode = 'P0001', message = 'An active booking already exists for this match';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at <= now() then
    raise exception using errcode = '22023', message = 'Invalid court time';
  end if;

  select *
  into v_court
  from public.courts as ct
  where ct.id = p_court_id
    and ct.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Court not found';
  end if;

  select *
  into v_club
  from public.clubs as c
  where c.id = v_court.club_id
    and c.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if public.court_has_block(v_court.id, p_starts_at, p_ends_at) then
    raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
  end if;

  begin
    insert into public.bookings (
      match_id,
      court_id,
      requested_by,
      status,
      starts_at,
      ends_at,
      price_minor,
      currency,
      payment_method,
      club_note,
      arranged_externally,
      acted_by,
      acted_at
    )
    values (
      p_match_id,
      v_court.id,
      v_user_id,
      'accepted',
      p_starts_at,
      p_ends_at,
      v_court.price_minor,
      v_court.currency,
      'pay_at_club',
      v_note,
      true,
      v_user_id,
      now()
    )
    returning id into v_booking_id;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'court_already_booked';
  end;

  perform public.append_booking_event(
    v_booking_id,
    null,
    'accepted',
    v_user_id,
    v_note,
    jsonb_build_object(
      'court_id', v_court.id,
      'club_id', v_club.id,
      'arranged_externally', true
    )
  );

  update public.matches
  set status = 'confirmed', updated_at = now()
  where id = p_match_id
    and status = 'ready_to_book';

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_user_id,
    'court_arranged_externally',
    'match',
    p_match_id,
    v_note,
    jsonb_build_object('club_id', v_club.id, 'court_id', v_court.id)
  );

  return v_booking_id;
end;
$$;

revoke all on function public.confirm_external_court(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.confirm_external_court(uuid, uuid, timestamptz, timestamptz, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. ready_to_book must not sit in limbo forever
-- ---------------------------------------------------------------------------

create or replace function public.match_should_expire(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_listing_expires timestamptz;
begin
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    return false;
  end if;

  if v_match.status not in ('open', 'full', 'ready_to_book') then
    return false;
  end if;

  if public.match_has_active_booking(p_match_id) then
    return false;
  end if;

  -- An agreed time that was never booked expires once it has passed, but the
  -- seven-day listing rule does not apply: the slot may legitimately be weeks
  -- out and the match is no longer competing for players.
  if v_match.status = 'ready_to_book' then
    return public.match_all_times_passed_grace(p_match_id);
  end if;

  v_listing_expires := public.match_listing_expires_at(
    v_match.created_at,
    v_match.listing_extended_at
  );

  return public.match_all_times_passed_grace(p_match_id)
    or v_listing_expires <= now();
end;
$$;

create or replace function public.expire_stale_matches()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select m.id as match_id
    from public.matches as m
    where m.status in ('open', 'full', 'ready_to_book')
      and public.match_should_expire(m.id)
  loop
    perform public.enqueue_notification(
      mp.user_id,
      'match_expired',
      'match',
      v_row.match_id,
      format('match_expired:%s:%s', v_row.match_id, mp.user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'Match expired',
        'body', 'This match listing has expired and is no longer open.'
      ),
      now()
    )
    from public.match_participants as mp
    where mp.match_id = v_row.match_id
      and mp.status = 'accepted';
  end loop;

  update public.matches as m
  set status = 'expired', updated_at = now()
  where m.status in ('open', 'full', 'ready_to_book')
    and public.match_should_expire(m.id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. A participant must be able to leave while the club deliberates
-- ---------------------------------------------------------------------------

create or replace function public.leave_match(p_match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_prior_status public.match_status;
  v_booking public.bookings%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  v_prior_status := v_match.status;

  if v_match.creator_id = v_user_id then
    raise exception using errcode = 'P0001', message = 'creator_should_cancel_match';
  end if;

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = 'P0002', message = 'Not an active participant';
  end if;

  -- booking_pending is included: a club can sit on a request for a day, and
  -- trapping someone for that long is how no-shows are made.
  if v_prior_status not in ('open', 'full', 'ready_to_book', 'booking_pending') then
    raise exception using errcode = 'P0001', message = 'match_not_leavable';
  end if;

  update public.match_participants
  set status = 'left', left_at = now()
  where match_id = p_match_id
    and user_id = v_user_id;

  update public.match_invitations
  set revoked_at = now()
  where match_id = p_match_id
    and created_by = v_user_id
    and revoked_at is null;

  if v_prior_status in ('full', 'ready_to_book', 'booking_pending') then
    insert into public.audit_events (
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      v_user_id,
      'participant_left_after_full',
      'match',
      p_match_id,
      jsonb_build_object('match_status', v_prior_status)
    );
  end if;

  -- Leaving during booking_pending invalidates the request the club is
  -- holding, so withdraw it rather than let staff accept a short roster.
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
      set status = 'cancelled', acted_by = v_user_id, acted_at = now(), updated_at = now()
      where id = v_booking.id;

      perform public.append_booking_event(
        v_booking.id,
        'requested',
        'cancelled',
        v_user_id,
        'Participant left before the club responded'
      );
    end if;

    update public.matches
    set status = 'ready_to_book', updated_at = now()
    where id = p_match_id
      and status = 'booking_pending';
  end if;

  perform public.refresh_match_open_state(p_match_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. One withdrawal must not destroy a booked doubles match
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_from_booked_match(
  p_match_id uuid,
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
  v_booking public.bookings%rowtype;
  v_reason text;
  v_attendance public.attendance_status;
  v_remaining integer;
  v_keeps_booking boolean;
begin
  v_user_id := public.assert_marketplace_caller();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'Withdrawal reason is required';
  end if;

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'Withdrawal is only available after a booking is accepted';
  end if;

  if v_match.creator_id = v_user_id then
    raise exception using errcode = 'P0001', message = 'Creator should cancel the match instead';
  end if;

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = 'P0002', message = 'Not an active participant';
  end if;

  select *
  into v_booking
  from public.bookings as b
  where b.match_id = p_match_id
    and b.status = 'accepted'
  order by b.created_at desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'Accepted booking not found';
  end if;

  v_attendance := public.classify_withdrawal_attendance(v_booking.starts_at);

  update public.match_participants
  set status = 'left', left_at = now(), attendance = v_attendance
  where match_id = p_match_id
    and user_id = v_user_id;

  v_remaining := public.match_participant_count(p_match_id);

  -- Singles has no match left once one side drops. Doubles keeps the court so
  -- the remaining three can find a replacement instead of losing their slot.
  v_keeps_booking := v_match.format = 'doubles' and v_remaining >= 2;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_user_id,
    'participant_withdrew_from_booked_match',
    'match',
    p_match_id,
    v_reason,
    jsonb_build_object(
      'attendance', v_attendance,
      'remaining', v_remaining,
      'kept_booking', v_keeps_booking
    )
  );

  if v_keeps_booking then
    return;
  end if;

  update public.bookings
  set status = 'cancelled', acted_by = v_user_id, acted_at = now(), updated_at = now()
  where id = v_booking.id;

  perform public.append_booking_event(
    v_booking.id,
    'accepted',
    'cancelled',
    v_user_id,
    v_reason
  );

  update public.matches
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = v_reason,
    updated_at = now()
  where id = p_match_id;

  update public.match_invitations
  set revoked_at = now()
  where match_id = p_match_id
    and revoked_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Overlap collisions should read as a court clash, not a Postgres error
-- ---------------------------------------------------------------------------

create or replace function public.accept_booking(p_booking_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_booking public.bookings%rowtype;
  v_club_id uuid;
begin
  select *
  into v_booking
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  select ct.club_id into v_club_id from public.courts as ct where ct.id = v_booking.court_id;
  v_user_id := public.assert_club_staff(v_club_id);

  if v_booking.status <> 'requested' then
    raise exception using errcode = 'P0001', message = 'Only requested bookings can be accepted';
  end if;

  if public.court_has_block(v_booking.court_id, v_booking.starts_at, v_booking.ends_at) then
    raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
  end if;

  begin
    update public.bookings
    set
      status = 'accepted',
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now(),
      proposed_court_id = null,
      proposed_start_at = null,
      proposed_end_at = null
    where id = p_booking_id;
  exception
    when exclusion_violation then
      -- no_overlapping_accepted_court_bookings; surfaced as a raw 23P01 before.
      raise exception using errcode = 'P0001', message = 'court_already_booked';
  end;

  perform public.append_booking_event(
    p_booking_id,
    'requested',
    'accepted',
    v_user_id
  );

  update public.matches
  set status = 'confirmed', updated_at = now()
  where id = v_booking.match_id
    and status = 'booking_pending';
end;
$$;
