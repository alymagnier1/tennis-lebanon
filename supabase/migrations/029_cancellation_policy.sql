-- Milestone 8.2: pilot cancellation and no-show policy windows.

create table if not exists public.platform_policy_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_policy_settings (key, value)
values ('late_cancel_hours', '24'::jsonb)
on conflict (key) do nothing;

revoke all on table public.platform_policy_settings from public, anon, authenticated;

create or replace function public.late_cancel_window_hours()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (pps.value #>> '{}')::integer
      from public.platform_policy_settings as pps
      where pps.key = 'late_cancel_hours'
    ),
    24
  );
$$;

create or replace function public.classify_withdrawal_attendance(
  p_booking_starts_at timestamptz
)
returns public.attendance_status
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hours integer;
begin
  if p_booking_starts_at is null then
    return 'cancelled_in_time';
  end if;

  v_hours := public.late_cancel_window_hours();

  if now() >= p_booking_starts_at - make_interval(hours => v_hours) then
    return 'late_cancel';
  end if;

  return 'cancelled_in_time';
end;
$$;

create or replace function public.leave_match(p_match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_status public.match_status;
begin
  v_user_id := public.assert_marketplace_caller();

  select m.status
  into v_status
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
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

  if v_status not in ('open', 'full', 'ready_to_book') then
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

  if v_status in ('full', 'ready_to_book') then
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
      jsonb_build_object('match_status', v_status)
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
    and b.status in ('requested', 'accepted')
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
  elsif v_booking.id is not null and v_booking.status = 'requested' then
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

  if exists (
    select 1
    from public.matches as m
    where m.id = p_match_id
      and m.creator_id = v_user_id
  ) then
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

  update public.match_participants as mp
  set
    status = 'left',
    left_at = now(),
    attendance = v_attendance
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

  update public.matches
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = v_reason,
    updated_at = now()
  where id = p_match_id;

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
    'participant_withdrew_after_booking',
    'match',
    p_match_id,
    v_reason,
    jsonb_build_object('attendance', v_attendance)
  );
end;
$$;

revoke all on function public.late_cancel_window_hours() from public, anon;
grant execute on function public.late_cancel_window_hours() to authenticated;

revoke all on function public.classify_withdrawal_attendance(timestamptz) from public, anon;
grant execute on function public.classify_withdrawal_attendance(timestamptz) to authenticated;

revoke all on function public.withdraw_from_booked_match(uuid, text) from public, anon;
grant execute on function public.withdraw_from_booked_match(uuid, text) to authenticated;
