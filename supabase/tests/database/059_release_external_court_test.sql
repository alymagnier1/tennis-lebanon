\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(5);

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

-- Mirrors 034_court_and_exit_paths_test.sql, which covers the confirm side.
create or replace function pg_temp.ready_match(
  p_creator uuid,
  p_joiner uuid,
  p_format public.match_format,
  p_starts timestamptz
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_existing_id uuid;
begin
  perform pg_temp.set_caller(p_creator);

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = p_format
      and lm.status in ('draft', 'open', 'full', 'ready_to_book')
  loop
    begin
      perform public.cancel_match(v_existing_id, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;

  v_match_id := public.create_and_publish_match(
    p_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', p_starts::text,
        'ends_at', (p_starts + interval '90 minutes')::text
      )
    ),
    'fixed',
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  perform pg_temp.set_caller(p_joiner);
  perform public.join_match(v_match_id);
  perform pg_temp.set_caller(p_creator);

  return v_match_id;
end;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Releasing is creator-only
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_starts timestamptz := now() + interval '3 days';
  v_message text := '';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, 'singles', v_starts);

  perform public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001',
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  perform pg_temp.set_caller(v_joiner);

  begin
    perform public.release_external_court(v_match_id, null);
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%Only the creator%',
    format('a joiner must not release the court, got: %s', v_message)
  );
end;
$$;

select pass('releasing a court is creator-only');

-- ---------------------------------------------------------------------------
-- Release cancels the booking and hands the match back to be re-booked
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_starts timestamptz := now() + interval '4 days';
  v_status public.match_status;
  v_accepted integer;
  v_cancelled integer;
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, 'singles', v_starts);

  perform public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001',
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  perform pg_temp.set_caller(v_creator);
  perform public.release_external_court(v_match_id, 'club double-booked us');

  reset role;

  select count(*)::integer into v_accepted
  from public.bookings as b
  where b.match_id = v_match_id and b.status = 'accepted';

  select count(*)::integer into v_cancelled
  from public.bookings as b
  where b.match_id = v_match_id and b.status = 'cancelled';

  select m.status into v_status
  from public.matches as m
  where m.id = v_match_id;

  set local role authenticated;

  perform pg_temp.assert_true(
    v_accepted = 0,
    format('no accepted booking should survive a release, found %s', v_accepted)
  );
  perform pg_temp.assert_true(
    v_cancelled = 1,
    format('the released booking should be cancelled, found %s', v_cancelled)
  );
  perform pg_temp.assert_true(
    v_status <> 'confirmed',
    format('a match without a court must not stay confirmed, got %s', v_status)
  );
end;
$$;

select pass('release cancels the booking and moves the match off confirmed');

-- ---------------------------------------------------------------------------
-- A club-accepted booking is not the host's to release
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_starts timestamptz := now() + interval '5 days';
  v_message text := '';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, 'singles', v_starts);

  perform public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001',
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  -- Stand in for a booking the club accepted through its own queue.
  reset role;
  update public.bookings
  set arranged_externally = false
  where match_id = v_match_id
    and status = 'accepted';
  set local role authenticated;

  perform pg_temp.set_caller(v_creator);

  begin
    perform public.release_external_court(v_match_id, null);
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%court_not_arranged_externally%',
    format('a club-accepted booking must not be host-releasable, got: %s', v_message)
  );
end;
$$;

select pass('a club-accepted booking cannot be released by the host');

-- ---------------------------------------------------------------------------
-- Once the hour has arrived, attendance owns the outcome
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_starts timestamptz := now() + interval '6 days';
  v_message text := '';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, 'singles', v_starts);

  perform public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001',
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  -- confirm_external_court refuses a past slot, so the clock is moved instead.
  reset role;
  update public.bookings
  set starts_at = now() - interval '1 hour',
      ends_at = now() + interval '30 minutes'
  where match_id = v_match_id
    and status = 'accepted';
  set local role authenticated;

  perform pg_temp.set_caller(v_creator);

  begin
    perform public.release_external_court(v_match_id, null);
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%match_already_started%',
    format('a started match must not release its court, got: %s', v_message)
  );
end;
$$;

select pass('a court cannot be released once the slot has started');

-- ---------------------------------------------------------------------------
-- The round trip: a released match can be booked again
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_starts timestamptz := now() + interval '7 days';
  v_booking_id uuid;
  v_status public.match_status;
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, 'singles', v_starts);

  perform public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001',
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  perform pg_temp.set_caller(v_creator);
  perform public.release_external_court(v_match_id, null);

  -- one_active_booking_per_match blocks a second accepted row, so this only
  -- succeeds because the released one is genuinely out of the way.
  v_booking_id := public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001',
    v_starts,
    v_starts + interval '90 minutes',
    'rebooked after the first fell through'
  );

  perform pg_temp.assert_true(
    v_booking_id is not null,
    'a released match must be bookable again'
  );

  reset role;
  select m.status into v_status from public.matches as m where m.id = v_match_id;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_status = 'confirmed',
    format('rebooking should confirm the match again, got %s', v_status)
  );
end;
$$;

select pass('a released match can be booked again');

select * from finish();

rollback;
