-- Releasing a court the host recorded himself.
--
-- confirm_external_court (058) is currently a one-way door. cancel_booking_request
-- only accepts status = 'requested' (014:485), and confirm_external_court refuses
-- to run at all once an accepted booking exists (058:74), so a host who taps
-- confirm while the club is still deciding has told the whole group to turn up
-- somewhere -- and cancelling the entire match is his only way out.
--
-- The mobile flow this supports asks the host to name the court he booked. That
-- is his word, not a club's, so it is exactly the kind of record that needs an
-- eraser. This is the reverse of 058: withdraw the booking, hand the match back
-- to refresh_match_open_state, and tell the people who were told it was booked.
--
-- Deliberately refuses a booking the club accepted (arranged_externally = false).
-- Those belong to the club's queue -- accept_booking / reject_booking (014) own
-- that lifecycle -- and a host must not be able to cancel one from the app. No
-- v1 club is a partner, so today this only guards the future.

create or replace function public.release_external_court(
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
  v_club_name text;
  v_note text;
  v_when text;
begin
  v_user_id := public.assert_marketplace_caller();
  v_note := nullif(trim(coalesce(p_reason, '')), '');

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  -- Host-only, matching confirm_external_court (058:51). Whoever committed the
  -- group to a venue is the one who can un-commit it.
  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the creator can release a court';
  end if;

  select *
  into v_booking
  from public.bookings as b
  where b.match_id = p_match_id
    and b.status = 'accepted'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No accepted court to release';
  end if;

  if v_booking.arranged_externally is distinct from true then
    raise exception using errcode = 'P0001', message = 'court_not_arranged_externally';
  end if;

  -- Once the hour has arrived the match either happened or did not, and that is
  -- what attendance and results are for. Releasing here would rewrite history.
  if v_booking.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'match_already_started';
  end if;

  update public.bookings
  set status = 'cancelled',
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now()
  where id = v_booking.id;

  perform public.append_booking_event(
    v_booking.id,
    'accepted',
    'cancelled',
    v_user_id,
    v_note,
    jsonb_build_object('released_by_host', true)
  );

  -- refresh_match_open_state owns the promotion to confirmed and only acts on
  -- open/full/ready_to_book, so hand it a status it accepts (058:240) and let it
  -- decide where the match lands now that the court is gone.
  update public.matches
  set status = 'ready_to_book', updated_at = now()
  where id = p_match_id
    and status = 'confirmed';

  perform public.refresh_match_open_state(p_match_id);

  select c.name
  into v_club_name
  from public.courts as ct
  join public.clubs as c on c.id = ct.club_id
  where ct.id = v_booking.court_id;

  -- These people were told the court was booked, by name and hour. Naming it
  -- again is the only way the correction lands on the same fact.
  v_when := to_char(v_booking.starts_at at time zone 'Asia/Beirut', 'Dy DD Mon, HH24:MI');

  perform public.enqueue_notification(
    mp.user_id,
    'match_court_released',
    'match',
    p_match_id,
    format('court_released:%s:%s', v_booking.id, mp.user_id),
    jsonb_build_object(
      'deepLink', format('/match/%s', p_match_id),
      'title', 'Court no longer booked',
      'body', format(
        '%s at %s fell through. The match still needs a court.',
        coalesce(v_club_name, 'The club'),
        v_when
      )
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
    'court_released_by_host',
    'match',
    p_match_id,
    v_note,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'court_id', v_booking.court_id,
      'starts_at', v_booking.starts_at
    )
  );
end;
$$;

revoke all on function public.release_external_court(uuid, text) from public, anon;
grant execute on function public.release_external_court(uuid, text) to authenticated;
