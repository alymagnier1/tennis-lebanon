-- Off-app court bookings could still strand a match.
--
-- 034 added confirm_external_court for the club that takes bookings by phone
-- or WhatsApp, but it only accepted the creator, and only while the match sat
-- in ready_to_book. Both limits bite in the cases that actually strand a match:
--
-- 1. booking_pending. The request went to the club, the club never replied, so
--    somebody rang them and booked it directly. That is precisely when the
--    in-app confirmation disappeared. The only way out was to cancel the club
--    request first and then confirm the court as a second, separate action.
-- 2. Whoever holds the club membership is usually the one who books, and that
--    is not always the match creator. They could not record it at all.
--
-- The one_active_booking_per_match index (001) already made it impossible for a
-- match to hold two active bookings, so the old two-step dance was not a
-- double-booking risk. It was fragile in a different way: the cancel succeeded
-- on its own, so a confirmation that then failed on a blocked court or a bad
-- time left the player with no club request and no court. Withdrawing inside
-- this function means the request is only given up if the replacement actually
-- lands, and the whole thing rolls back together if it does not.
--
-- Requesting a club court stays creator-only; that is a different permission
-- and keeps its own check in request_match_booking.

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
  v_pending record;
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

  -- Any accepted participant, not just the creator.
  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only a match participant can confirm a court';
  end if;

  if v_match.status not in ('ready_to_book', 'booking_pending') then
    raise exception using errcode = 'P0001', message = 'Match is not ready to book';
  end if;

  perform public.assert_match_roster_full(p_match_id);

  -- An accepted booking means a court is already secured through the app.
  -- Nothing is stuck, so this stays an error rather than being superseded.
  if exists (
    select 1
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status = 'accepted'
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

  -- Withdraw anything still sitting with the club, in this transaction rather
  -- than as a separate client call. one_active_booking_per_match means the
  -- insert below cannot succeed while a request is outstanding, so this is what
  -- makes the booking_pending case work at all -- and because it shares the
  -- transaction, a court that turns out to be blocked or mistimed rolls the
  -- withdrawal back rather than leaving the match with neither.
  -- accept_booking requires status 'requested', so once cancelled the club can
  -- no longer act on the superseded request either.
  for v_pending in
    select b.id, b.status
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status in ('requested', 'alternative_proposed')
    for update
  loop
    update public.bookings
    set status = 'cancelled',
        acted_by = v_user_id,
        acted_at = now(),
        updated_at = now()
    where id = v_pending.id;

    perform public.append_booking_event(
      v_pending.id,
      v_pending.status,
      'cancelled',
      v_user_id,
      v_note,
      jsonb_build_object('superseded_by', 'external_court')
    );
  end loop;

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
    and status in ('ready_to_book', 'booking_pending');

  -- Now that someone other than the creator can do this, silence would leave
  -- the rest of the group still believing the match is waiting on a court.
  perform public.enqueue_notification(
    mp.user_id,
    'match_court_confirmed',
    'match',
    p_match_id,
    format('external_court:%s:%s', v_booking_id, mp.user_id),
    jsonb_build_object(
      'deepLink', format('/match/%s', p_match_id),
      'title', 'Court confirmed',
      'body', 'A court has been arranged directly with the club. Your match is confirmed.'
    ),
    now()
  )
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.status = 'accepted'
    and mp.user_id <> v_user_id;

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
