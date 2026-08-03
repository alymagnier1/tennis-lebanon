-- The defining WhatsApp exchange is "6pm is taken, I have 7pm on Court 2", and
-- the app could not record it. confirm_external_court has always accepted
-- arbitrary times, but the screen only ever sent the agreed slot, so the club
-- offering a different hour dead-ended: the host had to reschedule the match
-- first (creator-only, a separate screen, and since 046 blocked outright once a
-- court exists) and only then record the court.
--
-- Opening the screen up is not enough on its own, which is what this migration
-- is for. selected_time_option_id would keep pointing at what the group agreed
-- while bookings held the hour they are actually playing: the hub would show
-- one time on its booking card and another in its details, and list_my_matches
-- reads the time option, so the matches list and home would show the old hour
-- too. The court's hour is the match's hour, so recording a different one
-- repoints the match.
--
-- Consistent with the off-list club rule in 045: allowed, but announced. The
-- alternative -- requiring everyone to re-agree before the court counts -- puts
-- the match back in the stranded state that 034, 041 and 046 exist to prevent,
-- and does it at the exact moment a real court is on the table.
--
-- refresh_match_open_state needs the matching change for flexible matches.
-- Resyncing withdraws the option everyone voted on, so without a court-aware
-- promotion refresh_match_time_agreement would demote the match straight back
-- to full. A booked court settles the hour; the poll is moot.

-- ---------------------------------------------------------------------------
-- 1. A booked court settles the hour for voting matches too
--
-- Copied forward from 046:88. Only the flexible branch changes; the fixed
-- branch already promotes on an accepted court.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 2. Recording a court can move the match
--
-- Copied forward from 046:169. Everything up to the booking insert is
-- unchanged; the time re-sync and the notice clauses are new.
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

    -- Committing a venue before the group exists is the host's call, and there
    -- is often nobody else in the match to make it.
    if v_match.creator_id <> v_user_id then
      raise exception using errcode = '42501', message = 'only_creator_can_secure_court_early';
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
