-- Milestone 8.7: match lifecycle hardening (audit reconciliation P0-03, P1-07, P1-08, P1-09, P2-01).

create or replace function public.assert_match_roster_full(p_match_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_format public.match_format;
  v_count integer;
  v_capacity integer;
begin
  select m.format
  into v_format
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  v_capacity := public.match_capacity_for_format(v_format);
  v_count := public.match_participant_count(p_match_id);

  if v_count < v_capacity then
    raise exception using errcode = 'P0001', message = 'match_roster_incomplete';
  end if;
end;
$$;

revoke all on function public.assert_match_roster_full(uuid) from public, anon;
grant execute on function public.assert_match_roster_full(uuid) to authenticated;

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

  if v_prior_status not in ('open', 'full', 'ready_to_book') then
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

  if v_prior_status in ('full', 'ready_to_book') then
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

  perform public.refresh_match_open_state(p_match_id);
end;
$$;

create or replace function public.cancel_match(
  p_match_id uuid,
  p_reason text default null
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
  v_attendance public.attendance_status := null;
begin
  v_user_id := public.assert_marketplace_caller();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the creator can cancel this match';
  end if;

  if v_match.status not in (
    'draft',
    'open',
    'full',
    'ready_to_book',
    'booking_pending',
    'confirmed'
  ) then
    raise exception using errcode = 'P0001', message = 'Match cannot be cancelled in its current state';
  end if;

  if v_match.status in ('full', 'ready_to_book', 'booking_pending', 'confirmed')
    and v_reason is null then
    raise exception using errcode = 'P0001', message = 'Cancellation reason is required';
  end if;

  select *
  into v_booking
  from public.bookings as b
  where b.match_id = p_match_id
    and b.status in ('requested', 'accepted', 'alternative_proposed')
  order by b.created_at desc
  limit 1;

  if v_booking.id is not null and v_booking.status = 'accepted' then
    v_attendance := public.classify_withdrawal_attendance(v_booking.starts_at);

    update public.match_participants as mp
    set attendance = v_attendance
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id;

    update public.bookings
    set
      status = 'cancelled',
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now()
    where id = v_booking.id;

    perform public.append_booking_event(
      v_booking.id,
      'accepted',
      'cancelled',
      v_user_id
    );
  elsif v_booking.id is not null
    and v_booking.status in ('requested', 'alternative_proposed') then
    update public.bookings
    set
      status = 'cancelled',
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now(),
      proposed_court_id = null,
      proposed_start_at = null,
      proposed_end_at = null
    where id = v_booking.id;

    perform public.append_booking_event(
      v_booking.id,
      v_booking.status,
      'cancelled',
      v_user_id
    );
  end if;

  update public.matches
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = v_reason,
    selected_time_option_id = null,
    updated_at = now()
  where id = p_match_id;

  update public.match_invitations
  set revoked_at = now()
  where match_id = p_match_id
    and revoked_at is null;

  if v_reason is not null then
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
      'match_cancelled',
      'match',
      p_match_id,
      v_reason,
      jsonb_build_object(
        'match_status', v_match.status,
        'attendance', v_attendance
      )
    );
  end if;
end;
$$;

create or replace function public.request_match_booking(
  p_match_id uuid,
  p_court_id uuid
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
  v_time public.match_time_options%rowtype;
  v_booking_id uuid;
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

  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the match creator can request a court';
  end if;

  if v_match.status <> 'ready_to_book' then
    raise exception using errcode = 'P0001', message = 'Match is not ready to book';
  end if;

  perform public.assert_match_roster_full(p_match_id);

  if v_match.selected_time_option_id is null then
    raise exception using errcode = 'P0001', message = 'No agreed time selected';
  end if;

  select *
  into v_time
  from public.match_time_options as mto
  where mto.id = v_match.selected_time_option_id
    and mto.match_id = p_match_id
    and mto.withdrawn_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'Agreed time is not available';
  end if;

  if exists (
    select 1
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status in ('requested', 'alternative_proposed', 'accepted')
  ) then
    raise exception using errcode = 'P0001', message = 'An active booking already exists for this match';
  end if;

  select *
  into v_court
  from public.courts as ct
  where ct.id = p_court_id
    and ct.is_active = true
  for update;

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

  if v_club.booking_mode <> 'manual_request' then
    raise exception using errcode = 'P0001', message = 'Club does not accept in-app booking requests';
  end if;

  if public.court_has_block(v_court.id, v_time.starts_at, v_time.ends_at) then
    raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
  end if;

  insert into public.bookings (
    match_id,
    court_id,
    requested_by,
    status,
    starts_at,
    ends_at,
    price_minor,
    currency,
    payment_method
  )
  values (
    p_match_id,
    v_court.id,
    v_user_id,
    'requested',
    v_time.starts_at,
    v_time.ends_at,
    v_court.price_minor,
    v_court.currency,
    'pay_at_club'
  )
  returning id into v_booking_id;

  perform public.append_booking_event(
    v_booking_id,
    null,
    'requested',
    v_user_id,
    null,
    jsonb_build_object('court_id', v_court.id, 'club_id', v_club.id)
  );

  update public.matches
  set status = 'booking_pending',
      updated_at = now()
  where id = p_match_id;

  return v_booking_id;
end;
$$;

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
  v_match_status public.match_status;
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

  select m.status
  into v_match_status
  from public.matches as m
  where m.id = v_booking.match_id
  for update;

  if v_match_status <> 'booking_pending' then
    raise exception using errcode = 'P0001', message = 'Match is not awaiting booking approval';
  end if;

  if public.court_has_block(v_booking.court_id, v_booking.starts_at, v_booking.ends_at) then
    raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
  end if;

  update public.bookings
  set status = 'accepted',
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now(),
      proposed_court_id = null,
      proposed_start_at = null,
      proposed_end_at = null
  where id = p_booking_id;

  perform public.append_booking_event(
    p_booking_id,
    'requested',
    'accepted',
    v_user_id
  );

  update public.matches
  set status = 'confirmed',
      updated_at = now()
  where id = v_booking.match_id
    and status = 'booking_pending';
end;
$$;

create or replace function public.withdraw_booking_alternative(
  p_booking_id uuid,
  p_reason text default null
)
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
  v_match_status public.match_status;
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

  if v_booking.status <> 'alternative_proposed' then
    raise exception using errcode = 'P0001', message = 'Only alternative proposals can be withdrawn';
  end if;

  select m.status
  into v_match_status
  from public.matches as m
  where m.id = v_booking.match_id
  for update;

  if v_match_status <> 'booking_pending' then
    raise exception using errcode = 'P0001', message = 'Match is not awaiting booking approval';
  end if;

  update public.bookings
  set status = 'requested',
      club_note = nullif(trim(coalesce(p_reason, '')), ''),
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now(),
      proposed_court_id = null,
      proposed_start_at = null,
      proposed_end_at = null
  where id = p_booking_id;

  perform public.append_booking_event(
    p_booking_id,
    'alternative_proposed',
    'requested',
    v_user_id,
    nullif(trim(coalesce(p_reason, '')), '')
  );
end;
$$;

create or replace function public.respond_booking_alternative(
  p_booking_id uuid,
  p_accept boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_booking public.bookings%rowtype;
  v_match_status public.match_status;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_booking
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if v_booking.requested_by <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the requester can respond to an alternative';
  end if;

  if v_booking.status <> 'alternative_proposed' then
    raise exception using errcode = 'P0001', message = 'No alternative to respond to';
  end if;

  select m.status
  into v_match_status
  from public.matches as m
  where m.id = v_booking.match_id
  for update;

  if v_match_status <> 'booking_pending' then
    raise exception using errcode = 'P0001', message = 'Match is not awaiting booking approval';
  end if;

  if p_accept then
    if v_booking.proposed_court_id is null
       or v_booking.proposed_start_at is null
       or v_booking.proposed_end_at is null then
      raise exception using errcode = 'P0001', message = 'Alternative details are incomplete';
    end if;

    if public.court_has_block(
      v_booking.proposed_court_id,
      v_booking.proposed_start_at,
      v_booking.proposed_end_at
    ) then
      raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
    end if;

    update public.bookings
    set status = 'accepted',
        court_id = v_booking.proposed_court_id,
        starts_at = v_booking.proposed_start_at,
        ends_at = v_booking.proposed_end_at,
        proposed_court_id = null,
        proposed_start_at = null,
        proposed_end_at = null,
        acted_by = v_user_id,
        acted_at = now(),
        updated_at = now()
    where id = p_booking_id;

    perform public.append_booking_event(
      p_booking_id,
      'alternative_proposed',
      'accepted',
      v_user_id
    );

    update public.matches
    set status = 'confirmed',
        updated_at = now()
    where id = v_booking.match_id
      and status = 'booking_pending';
  else
    update public.bookings
    set status = 'cancelled',
        acted_by = v_user_id,
        acted_at = now(),
        updated_at = now(),
        proposed_court_id = null,
        proposed_start_at = null,
        proposed_end_at = null
    where id = p_booking_id;

    perform public.append_booking_event(
      p_booking_id,
      'alternative_proposed',
      'cancelled',
      v_user_id,
      'Requester declined alternative'
    );

    update public.matches
    set status = 'ready_to_book',
        updated_at = now()
    where id = v_booking.match_id
      and status = 'booking_pending';
  end if;
end;
$$;

revoke all on function public.leave_match(uuid) from public, anon;
grant execute on function public.leave_match(uuid) to authenticated;

revoke all on function public.cancel_match(uuid, text) from public, anon;
grant execute on function public.cancel_match(uuid, text) to authenticated;

revoke all on function public.request_match_booking(uuid, uuid) from public, anon;
grant execute on function public.request_match_booking(uuid, uuid) to authenticated;

revoke all on function public.accept_booking(uuid) from public, anon;
grant execute on function public.accept_booking(uuid) to authenticated;

revoke all on function public.withdraw_booking_alternative(uuid, text) from public, anon;
grant execute on function public.withdraw_booking_alternative(uuid, text) to authenticated;

revoke all on function public.respond_booking_alternative(uuid, boolean) from public, anon;
grant execute on function public.respond_booking_alternative(uuid, boolean) to authenticated;
