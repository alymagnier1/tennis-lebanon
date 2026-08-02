\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(7);

create or replace function pg_temp.assert_true(
  p_condition boolean,
  p_description text
)
returns void
language plpgsql
as $$
begin
  if not p_condition then
    raise exception '%', p_description;
  end if;
end;
$$;

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

create or replace function pg_temp.clear_hosted(p_creator uuid)
returns void
language plpgsql
as $$
declare
  v_existing uuid;
begin
  perform pg_temp.set_caller(p_creator);

  for v_existing in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft', 'open', 'full', 'ready_to_book', 'booking_pending')
  loop
    begin
      perform public.cancel_match(v_existing, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;
end;
$$;

create or replace function pg_temp.publish(
  p_creator uuid,
  p_format public.match_format,
  p_timing text,
  p_starts timestamptz
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
begin
  perform pg_temp.clear_hosted(p_creator);

  v_match_id := public.create_and_publish_match(
    p_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    case
      when p_timing = 'fixed' then
        jsonb_build_array(
          jsonb_build_object(
            'starts_at', p_starts::text,
            'ends_at', (p_starts + interval '90 minutes')::text
          )
        )
      else
        jsonb_build_array(
          jsonb_build_object(
            'starts_at', p_starts::text,
            'ends_at', (p_starts + interval '90 minutes')::text
          ),
          jsonb_build_object(
            'starts_at', (p_starts + interval '1 day')::text,
            'ends_at', (p_starts + interval '1 day 90 minutes')::text
          )
        )
    end,
    p_timing,
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  return v_match_id;
end;
$$;

create or replace function pg_temp.match_status(p_match_id uuid)
returns public.match_status
language sql
as $$
  select m.status from public.matches as m where m.id = p_match_id;
$$;

-- ---------------------------------------------------------------------------
-- The court comes first and the last join is what completes the match
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_starts timestamptz := now() + interval '5 days';
  v_match uuid;
  v_booking uuid;
  v_bstatus public.booking_status;
begin
  v_match := pg_temp.publish(v_creator, 'singles', 'fixed', v_starts);

  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'open',
    'a freshly published match is open'
  );

  perform pg_temp.set_caller(v_creator);
  v_booking := public.confirm_external_court(
    v_match, v_court, v_starts, v_starts + interval '90 minutes', null
  );

  select b.status into v_bstatus from public.bookings as b where b.id = v_booking;

  -- The whole point: the court is real while the match is still recruiting.
  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'open' and v_bstatus = 'accepted',
    format(
      'court-first should leave the match open with an accepted booking, got %s / %s',
      pg_temp.match_status(v_match), v_bstatus
    )
  );

  -- Nobody touches a booking RPC here; refresh_match_open_state promotes it.
  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);

  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'confirmed',
    format('filling the roster should confirm the match, got %s', pg_temp.match_status(v_match))
  );
end;
$$;

select pass('a court secured before the roster fills confirms on the last join');

-- ---------------------------------------------------------------------------
-- A court-first match is still joinable and still advertises the court
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  -- Needs an overlapping band and must not be blocked by the creator; the seed
  -- has 11111111 blocking 66666666.
  v_searcher uuid := '14141414-1414-1414-1414-141414141414';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_starts timestamptz := now() + interval '6 days';
  v_match uuid;
  v_secured boolean;
  v_club text;
begin
  v_match := pg_temp.publish(v_creator, 'doubles', 'fixed', v_starts);

  perform pg_temp.set_caller(v_creator);
  perform public.confirm_external_court(
    v_match, v_court, v_starts, v_starts + interval '90 minutes', null
  );

  perform pg_temp.set_caller(v_searcher);

  select card.court_secured, card.court_club_name
  into v_secured, v_club
  from public.discover_open_matches(
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[]
  ) as card
  where card.match_id = v_match;

  perform pg_temp.assert_true(
    coalesce(v_secured, false) and v_club = 'Pilot Tennis Club',
    format('discover should advertise the secured court, got %s / %s', v_secured, v_club)
  );

  -- Advertising it is pointless if nobody can act on it.
  perform public.join_match(v_match);

  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'open',
    'a doubles match at 2 of 4 stays open after a join'
  );
end;
$$;

select pass('a court-first match stays discoverable and joinable');

-- ---------------------------------------------------------------------------
-- Booking early is narrower than booking once the roster is full
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_starts timestamptz := now() + interval '7 days';
  v_match uuid;
  v_non_creator text;
  v_flexible text;
begin
  -- Committing a venue before the group exists is the host's call.
  v_match := pg_temp.publish(v_creator, 'doubles', 'fixed', v_starts);
  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);

  begin
    perform public.confirm_external_court(
      v_match, v_court, v_starts, v_starts + interval '90 minutes', null
    );
    v_non_creator := 'no error';
  exception
    when others then
      v_non_creator := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_non_creator = 'only_creator_can_secure_court_early',
    format('a joiner must not secure a court early, got %s', v_non_creator)
  );

  -- A court needs an hour, and a flexible match has none until the vote lands.
  v_match := pg_temp.publish(v_creator, 'singles', 'flexible', v_starts);

  perform pg_temp.set_caller(v_creator);
  begin
    perform public.confirm_external_court(
      v_match, v_court, v_starts, v_starts + interval '90 minutes', null
    );
    v_flexible := 'no error';
  exception
    when others then
      v_flexible := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_flexible = 'match_uses_time_voting',
    format('a flexible match must not be booked early, got %s', v_flexible)
  );
end;
$$;

select pass('booking early is creator-only and fixed-timing only');

-- ---------------------------------------------------------------------------
-- The original roster-first path is unchanged
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_starts timestamptz := now() + interval '8 days';
  v_match uuid;
begin
  v_match := pg_temp.publish(v_creator, 'singles', 'fixed', v_starts);

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);

  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'ready_to_book',
    format('a full fixed match with no court is ready_to_book, got %s', pg_temp.match_status(v_match))
  );

  -- Still any accepted participant, not just the creator.
  perform public.confirm_external_court(
    v_match, v_court, v_starts, v_starts + interval '90 minutes', null
  );

  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'confirmed',
    format('roster-first should still confirm, got %s', pg_temp.match_status(v_match))
  );
end;
$$;

select pass('the roster-first path still confirms unchanged');

-- ---------------------------------------------------------------------------
-- The court survives roster churn, and the hour cannot be moved under it
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_starts timestamptz := now() + interval '9 days';
  v_match uuid;
  v_reschedule text;
begin
  v_match := pg_temp.publish(v_creator, 'doubles', 'fixed', v_starts);

  perform pg_temp.set_caller(v_creator);
  perform public.confirm_external_court(
    v_match, v_court, v_starts, v_starts + interval '90 minutes', null
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);
  perform public.leave_match(v_match);

  -- Surviving roster churn is what court-first buys the host.
  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'open'
      and public.match_has_accepted_court(v_match),
    format('leaving must keep the court, got %s', pg_temp.match_status(v_match))
  );

  perform pg_temp.set_caller(v_creator);
  begin
    perform public.reschedule_match_time(
      v_match, v_starts + interval '1 day', v_starts + interval '1 day 90 minutes'
    );
    v_reschedule := 'no error';
  exception
    when others then
      v_reschedule := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_reschedule = 'match_time_locked_by_booking',
    format('an open match holding a court must not be moved, got %s', v_reschedule)
  );
end;
$$;

select pass('the court survives a leave and locks the hour');

-- ---------------------------------------------------------------------------
-- An unfilled court-first match expires on the court's hour, not before
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_starts timestamptz := now() + interval '10 days';
  v_match uuid;
  v_booking uuid;
begin
  v_match := pg_temp.publish(v_creator, 'singles', 'fixed', v_starts);

  perform pg_temp.set_caller(v_creator);
  v_booking := public.confirm_external_court(
    v_match, v_court, v_starts, v_starts + interval '90 minutes', null
  );

  perform pg_temp.assert_true(
    not public.match_should_expire(v_match),
    'a court-first match must not expire while its court is still ahead'
  );

  -- confirm_external_court refuses a past court, so the clock is moved instead.
  update public.bookings
  set starts_at = now() - interval '3 days',
      ends_at = now() - interval '3 days' + interval '90 minutes'
  where id = v_booking;

  perform pg_temp.assert_true(
    public.match_should_expire(v_match),
    'a court-first match must expire once its court hour has passed'
  );
end;
$$;

select pass('an unfilled court-first match expires on the court hour');

-- ---------------------------------------------------------------------------
-- The host is warned before the court goes to waste
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_soon timestamptz := now() + interval '6 hours';
  v_match uuid;
  v_notified integer;
  v_body text;
begin
  v_match := pg_temp.publish(v_creator, 'singles', 'fixed', v_soon);

  perform pg_temp.set_caller(v_creator);
  perform public.confirm_external_court(
    v_match, v_court, v_soon, v_soon + interval '90 minutes', null
  );

  v_notified := public.court_first_roster_reminders();

  perform pg_temp.assert_true(
    v_notified >= 1,
    format('the host should be warned about the short roster, got %s', v_notified)
  );

  select n.payload ->> 'body'
  into v_body
  from public.notifications as n
  where n.entity_id = v_match
    and n.kind = 'court_first_roster_short'
  order by n.created_at desc
  limit 1;

  perform pg_temp.assert_true(
    v_body like '%Pilot Tennis Club%',
    format('the warning should name the club, got %s', v_body)
  );

  -- Running the job twice must not notify twice; the dedup key is per booking.
  perform pg_temp.assert_true(
    public.court_first_roster_reminders() = 0,
    'the nudge must not repeat on the next sweep'
  );
end;
$$;

select pass('the host is warned once when the court is near and the roster is short');

select * from finish();

rollback;
