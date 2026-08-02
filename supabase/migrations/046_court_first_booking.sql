-- Every booking path required a full roster first: request_match_booking
-- (030:281) and confirm_external_court (045:856) both called
-- assert_match_roster_full, and confirm_external_court only ran from
-- ready_to_book or booking_pending. So the app insisted on roster-then-court.
--
-- That is backwards for a Lebanese player who holds a club membership. Getting
-- a court takes two minutes; finding a fourth is the hard part. This lets the
-- host secure the court first and recruit against it, which does not manage the
-- stranded match so much as remove it -- the court exists before anyone joins.
-- A listing that already has a court is also markedly easier to fill, which is
-- why the court now shows in discovery.
--
-- The pivot is what `confirmed` means. It used to mean "an accepted booking
-- exists", which is precisely what forced the ordering. It now means "full
-- roster AND accepted court". A match holding a court while still recruiting
-- keeps its ordinary roster-driven status, so discovery, joining, leaving and
-- the host's active-match slot all keep working untouched.
--
-- refresh_match_open_state (033:130) already owns the roster-to-status mapping
-- and is already called from every join, leave, invite and request path, so
-- teaching it about bookings is what makes both orderings fall out of one
-- place. confirm_external_court stops writing `confirmed` itself and delegates.
--
-- A new status such as `court_secured` was the alternative. It would have to be
-- threaded through every status list, the discovery filter, joinability, the
-- cancellation policy and three locale files, to express something the pair
-- (roster, booking) already says.
--
-- Court-first is fixed-timing only: a court needs an hour, and a flexible match
-- has no agreed slot until the vote resolves. The in-app club queue stays
-- roster-first, because request_match_booking moves the match to
-- booking_pending, which would make it undiscoverable and unjoinable.

-- ---------------------------------------------------------------------------
-- 1. Shared accessor
--
-- one_active_booking_per_match (001:284) guarantees at most one row here.
-- ---------------------------------------------------------------------------

create or replace function public.match_accepted_booking(p_match_id uuid)
returns public.bookings
language sql
stable
security definer
set search_path = ''
as $$
  select b.*
  from public.bookings as b
  where b.match_id = p_match_id
    and b.status = 'accepted'
  limit 1;
$$;

create or replace function public.match_has_accepted_court(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status = 'accepted'
  );
$$;

revoke all on function public.match_accepted_booking(uuid) from public, anon, authenticated;
revoke all on function public.match_has_accepted_court(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The roster-to-status mapping learns about courts
--
-- Copied forward from 033:130. The only change is the first branch: a full
-- fixed roster that already holds a court is confirmed outright, because the
-- last join is the thing that was missing. The early return for statuses past
-- ready_to_book is retained, and is what stops a genuinely confirmed match
-- from ever being demoted here.
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
-- 3. Recording a court no longer waits for the roster
--
-- Copied forward from 045:802, keeping the preferred-club off-list flag and
-- notice. assert_match_roster_full is gone: ready_to_book and booking_pending
-- both already imply a full roster, so the check only ever blocked the new
-- case. The status write is delegated to refresh_match_open_state.
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
  v_final_status public.match_status;
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
      'off_preferred_list', v_off_shortlist
    )
  );

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

  v_body := case
    when v_off_shortlist then format(
      '%s at %s. This club was not on the list agreed when players joined.',
      v_club.name,
      v_when
    )
    when v_final_status = 'confirmed' then format(
      '%s at %s. Your match is confirmed.',
      v_club.name,
      v_when
    )
    else format(
      '%s at %s. The court is held while the match fills.',
      v_club.name,
      v_when
    )
  end;

  perform public.enqueue_notification(
    mp.user_id,
    'match_court_confirmed',
    'match',
    p_match_id,
    format('external_court:%s:%s', v_booking_id, mp.user_id),
    jsonb_build_object(
      'deepLink', format('/match/%s', p_match_id),
      'title', 'Court confirmed',
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
      'court_first', v_final_status <> 'confirmed'
    )
  );

  return v_booking_id;
end;
$$;

revoke all on function public.confirm_external_court(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.confirm_external_court(uuid, uuid, timestamptz, timestamptz, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. An unfilled court-first match must still expire
--
-- Copied forward from 034:192. It used to return false for any active booking,
-- which would make every court-first match that never filled immortal: it would
-- hold the host's active-match slot and sit in discovery forever. A request
-- still suppresses expiry, because the club is deliberating and
-- booking_stale_reminders is already chasing it. An accepted court makes the
-- court's own hour the deadline -- once that has passed the match cannot happen.
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
  v_booking public.bookings%rowtype;
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

  if exists (
    select 1
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status in ('requested', 'alternative_proposed')
  ) then
    return false;
  end if;

  v_booking := public.match_accepted_booking(p_match_id);

  if v_booking.id is not null then
    return v_booking.ends_at <= now() - interval '24 hours';
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

-- ---------------------------------------------------------------------------
-- 5. Warn the host before the court goes to waste
-- ---------------------------------------------------------------------------

create or replace function public.court_first_roster_reminders()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row record;
  v_notification_id uuid;
begin
  for v_row in
    select
      m.id as match_id,
      m.creator_id,
      b.id as booking_id,
      b.starts_at,
      c.name as club_name,
      public.match_capacity_for_format(m.format)
        - public.match_participant_count(m.id) as spots_left
    from public.matches as m
    join public.bookings as b
      on b.match_id = m.id
     and b.status = 'accepted'
    join public.courts as ct on ct.id = b.court_id
    join public.clubs as c on c.id = ct.club_id
    where m.status in ('open', 'full')
      and b.starts_at > now()
      and b.starts_at <= now() + interval '24 hours'
      and public.match_participant_count(m.id)
          < public.match_capacity_for_format(m.format)
  loop
    v_notification_id := public.enqueue_notification(
      v_row.creator_id,
      'court_first_roster_short',
      'match',
      v_row.match_id,
      format('court_first_roster_short:%s:%s', v_row.booking_id, v_row.creator_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'Court booked, players missing',
        'body', format(
          'Your court at %s is on %s and you still need %s more. Invite someone or release the court.',
          v_row.club_name,
          to_char(v_row.starts_at at time zone 'Asia/Beirut', 'Dy DD Mon, HH24:MI'),
          v_row.spots_left
        )
      ),
      now()
    );

    if v_notification_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.run_notification_jobs()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stale_reminders integer;
  v_expired_matches integer;
  v_booking_reminders jsonb;
  v_court_first_reminders integer;
begin
  v_stale_reminders := public.schedule_stale_match_reminders();
  v_expired_matches := public.expire_stale_matches();
  v_booking_reminders := public.booking_stale_reminders();
  v_court_first_reminders := public.court_first_roster_reminders();

  return jsonb_build_object(
    'stale_reminders_enqueued', v_stale_reminders,
    'matches_expired', v_expired_matches,
    'booking_reminders', v_booking_reminders,
    'court_first_reminders_enqueued', v_court_first_reminders
  );
end;
$$;

revoke all on function public.court_first_roster_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. A booked hour cannot be moved
--
-- Copied forward from 033:798. The status list alone used to prove the hour was
-- free, because nothing before ready_to_book could hold a court. Court-first
-- breaks that, so the booking is now checked directly.
-- ---------------------------------------------------------------------------

create or replace function public.reschedule_match_time(
  p_match_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
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
  v_option_id uuid;
  v_participant record;
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
    raise exception using errcode = '42501', message = 'Only the creator can change the time';
  end if;

  if v_match.timing_mode <> 'fixed' then
    raise exception using errcode = 'P0001', message = 'match_uses_time_voting';
  end if;

  -- Once a court has been requested the hour is committed at the club; the
  -- booking must be withdrawn before the match can move.
  if v_match.status not in ('draft', 'open', 'full', 'ready_to_book') then
    raise exception using errcode = 'P0001', message = 'match_time_locked_by_booking';
  end if;

  -- Court-first puts an accepted court on a match that is still open, so the
  -- status no longer proves the hour is free.
  if public.match_has_accepted_court(p_match_id) then
    raise exception using errcode = 'P0001', message = 'match_time_locked_by_booking';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at <= now() then
    raise exception using errcode = '22023', message = 'Invalid proposed time';
  end if;

  update public.match_time_options
  set withdrawn_at = now()
  where match_id = p_match_id
    and withdrawn_at is null;

  insert into public.match_time_options (match_id, starts_at, ends_at, proposed_by)
  values (p_match_id, p_starts_at, p_ends_at, v_user_id)
  returning id into v_option_id;

  update public.matches
  set selected_time_option_id = v_option_id, updated_at = now()
  where id = p_match_id;

  perform public.refresh_match_open_state(p_match_id);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'match_time_rescheduled',
    'match',
    p_match_id,
    jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at)
  );

  -- Everyone who already committed to the old time needs to know.
  for v_participant in
    select mp.user_id
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'accepted'
      and mp.user_id <> v_user_id
  loop
    perform public.enqueue_notification(
      v_participant.user_id,
      'match_time_changed',
      'match',
      p_match_id,
      format('match_time_changed:%s:%s:%s', p_match_id, v_participant.user_id, v_option_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', p_match_id),
        'title', 'Match time changed',
        'body', 'The host moved this match. Open the app to see the new time.'
      ),
      now()
    );
  end loop;

  return v_option_id;
end;
$$;

revoke all on function public.reschedule_match_time(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.reschedule_match_time(uuid, timestamptz, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 7. The host's own list shows the court
--
-- Copied forward from 018:204. Without this, home keeps telling a host to book
-- a court they already hold.
-- ---------------------------------------------------------------------------

drop function if exists public.list_my_matches();

create or replace function public.list_my_matches()
returns table (
  match_id uuid,
  format public.match_format,
  status public.match_status,
  visibility public.match_visibility,
  intent public.play_intent,
  participant_status public.participant_status,
  is_creator boolean,
  participant_count integer,
  capacity integer,
  soonest_time timestamptz,
  notes text,
  updated_at timestamptz,
  listing_expires_at timestamptz,
  is_stale_warning boolean,
  can_extend_listing boolean,
  has_court boolean,
  court_starts_at timestamptz
)
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
    m.id,
    m.format,
    m.status,
    m.visibility,
    m.intent,
    mp.status,
    mp.is_creator,
    public.match_participant_count(m.id),
    public.match_capacity_for_format(m.format),
    (
      select min(mto.starts_at)
      from public.match_time_options as mto
      where mto.match_id = m.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ),
    m.notes,
    m.updated_at,
    public.match_listing_expires_at(m.created_at, m.listing_extended_at),
    public.match_is_stale_warning(m.id),
    (
      mp.is_creator
      and m.status in ('open', 'full')
      and public.match_is_stale_warning(m.id)
    ),
    (b.id is not null),
    b.starts_at
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  left join public.bookings as b
    on b.match_id = m.id
   and b.status = 'accepted'
  where mp.user_id = v_user_id
    and mp.status in ('accepted', 'requested', 'invited')
    and m.status in (
      'draft',
      'open',
      'full',
      'ready_to_book',
      'booking_pending',
      'confirmed',
      'in_progress'
    )
  order by m.updated_at desc;
end;
$$;

revoke all on function public.list_my_matches() from public, anon;
grant execute on function public.list_my_matches() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Discovery shows the court
--
-- The recruiting advantage that motivates the whole feature: a listing that
-- already has a court is far easier to fill. Copied forward from 045.
-- ---------------------------------------------------------------------------

alter type public.discover_open_match_card
  add attribute court_secured boolean,
  add attribute court_club_name text;

create or replace function public.discover_open_matches(
  p_zone_ids uuid[] default null,
  p_format public.match_format default null,
  p_intent public.play_intent default null,
  p_horizon_days integer default 14,
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null
)
returns setof public.discover_open_match_card
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_viewer_band public.skill_band;
  v_zone_ids uuid[];
  v_range_start timestamptz := now();
  v_range_end timestamptz;
  v_limit integer;
begin
  v_viewer_id := public.assert_discovery_caller_eligible();
  perform public.enforce_discovery_rate_limit(v_viewer_id, 'open_matches');

  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_range_end := v_range_start + make_interval(
    days => least(greatest(coalesce(p_horizon_days, 14), 1), 28)
  );

  select pp.skill_band
  into v_viewer_band
  from public.player_profiles as pp
  where pp.user_id = v_viewer_id;

  if p_zone_ids is null or cardinality(p_zone_ids) = 0 then
    select coalesce(array_agg(pz.zone_id order by pz.priority), '{}'::uuid[])
    into v_zone_ids
    from public.player_zones as pz
    where pz.user_id = v_viewer_id;
  else
    v_zone_ids := p_zone_ids;
  end if;

  return query
  with eligible_matches as (
    select
      m.id,
      m.format,
      m.intent,
      m.visibility,
      m.status,
      m.requires_creator_approval,
      m.min_skill,
      m.max_skill,
      m.notes,
      m.created_at,
      public.match_participant_count(m.id) as participant_count,
      case when m.format = 'singles' then 2 else 4 end as capacity,
      cp.display_name as creator_display_name,
      cp.avatar_path as creator_avatar_path,
      (
        public.skill_band_rank(v_viewer_band) >= public.skill_band_rank(m.min_skill)
        and public.skill_band_rank(v_viewer_band) <= public.skill_band_rank(m.max_skill)
      ) as level_fit,
      exists (
        select 1
        from public.match_zones as mz
        where mz.match_id = m.id
          and mz.zone_id = any(v_zone_ids)
      ) as zone_overlap,
      public.viewer_match_time_overlap(
        v_viewer_id,
        m.id,
        v_range_start,
        v_range_end
      ) as availability_overlap,
      (
        select min(mto.starts_at)
        from public.match_time_options as mto
        where mto.match_id = m.id
          and mto.withdrawn_at is null
          and mto.ends_at > now()
      ) as soonest_time
    from public.matches as m
    join public.profiles as cp on cp.id = m.creator_id
    where m.status = 'open'
      and m.visibility = 'public'
      and not public.is_blocked(v_viewer_id, m.creator_id)
      and not exists (
        select 1
        from public.match_participants as mp
        where mp.match_id = m.id
          and mp.user_id = v_viewer_id
          and mp.status in ('accepted', 'requested', 'invited')
      )
      and public.skill_band_rank(v_viewer_band) >= public.skill_band_rank(m.min_skill)
      and public.skill_band_rank(v_viewer_band) <= public.skill_band_rank(m.max_skill)
      and (
        cardinality(v_zone_ids) = 0
        or exists (
          select 1
          from public.match_zones as mz
          where mz.match_id = m.id
            and mz.zone_id = any(v_zone_ids)
        )
      )
      and public.match_participant_count(m.id) < case when m.format = 'singles' then 2 else 4 end
      and exists (
        select 1
        from public.match_time_options as mto
        where mto.match_id = m.id
          and mto.withdrawn_at is null
          and mto.ends_at > now()
      )
      and (p_format is null or m.format = p_format)
      and (p_intent is null or m.intent = p_intent)
      and (p_cursor_created_at is null or m.created_at < p_cursor_created_at)
  )
  select
    em.id,
    em.format,
    em.intent,
    em.visibility,
    em.status,
    em.requires_creator_approval,
    em.min_skill,
    em.max_skill,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', z.id,
            'slug', z.slug,
            'name_i18n', z.name_i18n
          )
        ),
        '[]'::jsonb
      )
      from public.match_zones as mz
      join public.zones as z on z.id = mz.zone_id
      where mz.match_id = em.id
    ) as zones,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', mto.id,
            'starts_at', mto.starts_at,
            'ends_at', mto.ends_at
          )
          order by mto.starts_at
        ),
        '[]'::jsonb
      )
      from public.match_time_options as mto
      where mto.match_id = em.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ) as proposed_times,
    em.participant_count,
    em.capacity,
    em.creator_display_name,
    em.creator_avatar_path,
    em.level_fit,
    em.zone_overlap,
    em.availability_overlap,
    em.created_at,
    em.notes,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'club_id', c.id,
            'name', c.name,
            'booking_mode', c.booking_mode
          )
          order by c.name
        ),
        '[]'::jsonb
      )
      from public.match_preferred_clubs as mpc
      join public.clubs as c on c.id = mpc.club_id
      where mpc.match_id = em.id
        and c.is_active = true
    ) as preferred_clubs,
    (bk.id is not null) as court_secured,
    bc.name as court_club_name
  from eligible_matches as em
  left join public.bookings as bk
    on bk.match_id = em.id
   and bk.status = 'accepted'
  left join public.courts as bct on bct.id = bk.court_id
  left join public.clubs as bc on bc.id = bct.club_id
  order by
    em.soonest_time asc nulls last,
    (em.capacity - em.participant_count) asc,
    em.created_at desc
  limit v_limit;
end;
$$;
