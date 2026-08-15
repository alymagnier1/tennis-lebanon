-- Host-only court booking: Contact (match WhatsApp) and Booked off-app both
-- commit the group to a venue. Joiners previously could do both (041), which
-- split who books; product rule is host-only for both.
-- Club-directory WhatsApp without a match_id stays open to eligible players.
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
  v_has_shortlist boolean;
  v_off_shortlist boolean;
  v_when text;
  v_body text;
  v_title text;
  v_final_status public.match_status;
  v_agreed_starts timestamptz;
  v_agreed_ends timestamptz;
  v_time_changed boolean := false;
  v_new_option_id uuid;
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

  -- Host-only: Contact and off-app confirm both commit the group to a venue.
  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the creator can confirm a court';
  end if;

  if v_match.status not in ('open', 'full', 'ready_to_book', 'booking_pending') then
    raise exception using errcode = 'P0001', message = 'Match is not ready to book';
  end if;

  if v_match.status in ('open', 'full') then
    -- Court-first. A court needs an hour, so the match must already have one:
    -- a flexible match has no agreed slot until the vote resolves, and booking
    -- against a time nobody voted for is how the vote gets bypassed.
    if v_match.timing_mode <> 'fixed' then
      raise exception using errcode = 'P0001', message = 'match_uses_time_voting';
    end if;

    if v_match.selected_time_option_id is null then
      raise exception using errcode = 'P0001', message = 'No agreed time selected';
    end if;
  end if;

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

  select exists (
    select 1
    from public.match_preferred_clubs as mpc
    where mpc.match_id = p_match_id
  )
  into v_has_shortlist;

  v_off_shortlist := v_has_shortlist and not exists (
    select 1
    from public.match_preferred_clubs as mpc
    where mpc.match_id = p_match_id
      and mpc.club_id = v_club.id
  );

  select mto.starts_at, mto.ends_at
  into v_agreed_starts, v_agreed_ends
  from public.match_time_options as mto
  where mto.id = v_match.selected_time_option_id;

  v_time_changed := v_agreed_starts is distinct from p_starts_at
    or v_agreed_ends is distinct from p_ends_at;

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
      'arranged_externally', true,
      'off_preferred_list', v_off_shortlist,
      'time_changed', v_time_changed
    )
  );

  -- The court's hour is the match's hour. Leaving the agreed option pointing at
  -- a time nobody is playing splits the hub between its booking card and its
  -- details, and list_my_matches reads the option rather than the booking, so
  -- the matches list and home would show the old hour indefinitely.
  if v_time_changed then
    update public.match_time_options
    set withdrawn_at = now()
    where match_id = p_match_id
      and withdrawn_at is null;

    insert into public.match_time_options (match_id, starts_at, ends_at, proposed_by)
    values (p_match_id, p_starts_at, p_ends_at, v_user_id)
    returning id into v_new_option_id;

    update public.matches
    set selected_time_option_id = v_new_option_id, updated_at = now()
    where id = p_match_id;
  end if;

  -- The club request has just been withdrawn, so the match is no longer
  -- waiting on them. refresh_match_open_state owns the promotion to confirmed
  -- and only acts on open/full/ready_to_book, so hand it a status it accepts
  -- and let it decide whether the roster is complete.
  update public.matches
  set status = 'ready_to_book', updated_at = now()
  where id = p_match_id
    and status = 'booking_pending';

  perform public.refresh_match_open_state(p_match_id);

  select m.status
  into v_final_status
  from public.matches as m
  where m.id = p_match_id;

  -- Naming the club and the hour is the point: "a court has been arranged" told
  -- the others a booking existed without telling them where to turn up. Beirut
  -- rather than UTC because a person reads this.
  v_when := to_char(p_starts_at at time zone 'Asia/Beirut', 'Dy DD Mon, HH24:MI');
  v_body := format('%s at %s.', v_club.name, v_when);

  if v_time_changed and v_agreed_starts is not null then
    v_body := v_body || format(
      ' Moved from %s.',
      to_char(v_agreed_starts at time zone 'Asia/Beirut', 'Dy DD Mon, HH24:MI')
    );
  end if;

  if v_off_shortlist then
    v_body := v_body || ' This club was not on the list agreed when players joined.';
  elsif v_final_status = 'confirmed' then
    v_body := v_body || ' Your match is confirmed.';
  else
    v_body := v_body || ' The court is held while the match fills.';
  end if;

  -- A moved hour is the part someone skimming a push notification must not
  -- miss, so it goes in the title rather than only the body.
  v_title := case
    when v_time_changed and v_agreed_starts is not null then 'Court confirmed, time changed'
    else 'Court confirmed'
  end;

  perform public.enqueue_notification(
    mp.user_id,
    'match_court_confirmed',
    'match',
    p_match_id,
    format('external_court:%s:%s', v_booking_id, mp.user_id),
    jsonb_build_object(
      'deepLink', format('/match/%s', p_match_id),
      'title', v_title,
      'body', v_body
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
    jsonb_build_object(
      'club_id', v_club.id,
      'court_id', v_court.id,
      'off_preferred_list', v_off_shortlist,
      'court_first', v_final_status <> 'confirmed',
      'time_changed', v_time_changed,
      'previous_starts_at', v_agreed_starts
    )
  );

  return v_booking_id;
end;
$$;

revoke all on function public.confirm_external_court(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.confirm_external_court(uuid, uuid, timestamptz, timestamptz, text)
  to authenticated;

create or replace function public.get_club_whatsapp_booking_link(
  p_club_id uuid,
  p_match_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_club public.clubs%rowtype;
  v_phone text;
  v_message text;
  v_match public.matches%rowtype;
  v_time public.match_time_options%rowtype;
  v_participant_count integer;
begin
  v_user_id := public.assert_discovery_caller_eligible();

  select *
  into v_club
  from public.clubs as c
  where c.id = p_club_id
    and c.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if v_club.booking_mode <> 'external_link' then
    raise exception using errcode = 'P0001', message = 'Club does not offer WhatsApp booking';
  end if;

  select public.normalize_booking_phone(cpc.booking_phone)
  into v_phone
  from public.club_private_contacts as cpc
  where cpc.club_id = p_club_id;

  if v_phone is null then
    raise exception using errcode = 'P0001', message = 'Club WhatsApp booking is not configured';
  end if;

  v_message := format(
    'Hello, I would like to book a court at %s through Tennis Lebanon.',
    v_club.name
  );

  if p_match_id is not null then
    select *
    into v_match
    from public.matches as m
    where m.id = p_match_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'Match not found';
    end if;

    -- Match-scoped WhatsApp is host-only (same as confirm_external_court).
    if v_match.creator_id <> v_user_id then
      raise exception using errcode = '42501', message = 'Only the creator can open match booking WhatsApp';
    end if;

    select count(*)::integer
    into v_participant_count
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'accepted';

    if v_match.selected_time_option_id is not null then
      select *
      into v_time
      from public.match_time_options as mto
      where mto.id = v_match.selected_time_option_id;
    end if;

    -- Built by concatenation rather than one dense format string. The original
    -- template put the newline in front of the optional time block, so the line
    -- after it ran on: "18:00 to 19:30Players: 2", and with no agreed time the
    -- same seam produced "Format: doublesPlayers: 2". Each line now carries its
    -- own break.
    v_message := format(
      'Hello, I would like to book a court at %s through Tennis Lebanon.',
      v_club.name
    )
    || format(E'\nFormat: %s', v_match.format)
    || case
         when v_time.id is not null then
           format(
             E'\nPreferred time: %s to %s',
             to_char(v_time.starts_at at time zone 'Asia/Beirut', 'Dy DD Mon HH24:MI'),
             to_char(v_time.ends_at at time zone 'Asia/Beirut', 'HH24:MI')
           )
         else ''
       end
    || format(E'\nPlayers: %s', coalesce(v_participant_count::text, '?'));
  end if;

  return jsonb_build_object(
    'club_id', v_club.id,
    'club_name', v_club.name,
    'phone_digits', v_phone,
    'message', v_message
  );
end;
$$;

revoke all on function public.get_club_whatsapp_booking_link(uuid, uuid) from public, anon;
grant execute on function public.get_club_whatsapp_booking_link(uuid, uuid) to authenticated;