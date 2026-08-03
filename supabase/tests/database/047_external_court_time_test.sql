\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(4);

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

-- A full singles match sitting at ready_to_book with an agreed time.
create or replace function pg_temp.ready_match(
  p_creator uuid,
  p_joiner uuid,
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
    'singles'::public.match_format,
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
    p_timing,
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  perform pg_temp.set_caller(p_joiner);
  perform public.join_match(v_match_id);
  perform pg_temp.set_caller(p_creator);

  return v_match_id;
end;
$$;

-- Runs as the session role rather than `authenticated`: identity comes from the
-- JWT claim, and this file asserts time-sync behaviour, not RLS. 045 and 046
-- already cover who may reach these tables.

-- ---------------------------------------------------------------------------
-- The club's hour becomes the match's hour
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_agreed timestamptz := now() + interval '5 days';
  v_club_hour timestamptz := now() + interval '5 days 1 hour';
  v_match uuid;
  v_selected uuid;
  v_withdrawn integer;
begin
  v_match := pg_temp.ready_match(v_creator, v_joiner, 'fixed', v_agreed);

  perform public.confirm_external_court(
    v_match, v_court, v_club_hour, v_club_hour + interval '90 minutes', null
  );

  select m.selected_time_option_id into v_selected
  from public.matches as m where m.id = v_match;

  perform pg_temp.assert_true(
    (select mto.starts_at from public.match_time_options as mto where mto.id = v_selected)
      = v_club_hour,
    'the agreed time must follow the court that was actually booked'
  );

  select count(*)::integer into v_withdrawn
  from public.match_time_options as mto
  where mto.match_id = v_match and mto.withdrawn_at is not null;

  perform pg_temp.assert_true(
    v_withdrawn = 1,
    format('the superseded option must be withdrawn, got %s', v_withdrawn)
  );

  -- list_my_matches reads the option rather than the booking, so leaving the
  -- old one live is what would show the wrong hour on the list and on home.
  perform pg_temp.assert_true(
    (
      select min(mto.starts_at)
      from public.match_time_options as mto
      where mto.match_id = v_match
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ) = v_club_hour,
    'the soonest live time must be the court hour'
  );

  perform pg_temp.assert_true(
    (select m.status from public.matches as m where m.id = v_match) = 'confirmed',
    'a moved time must still confirm the match'
  );
end;
$$;

select pass('recording a different hour moves the match to the court');

-- ---------------------------------------------------------------------------
-- Recording the agreed hour changes nothing
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_agreed timestamptz := now() + interval '6 days';
  v_match uuid;
  v_before uuid;
  v_options integer;
begin
  v_match := pg_temp.ready_match(v_creator, v_joiner, 'fixed', v_agreed);

  select m.selected_time_option_id into v_before
  from public.matches as m where m.id = v_match;

  perform public.confirm_external_court(
    v_match, v_court, v_agreed, v_agreed + interval '90 minutes', null
  );

  select count(*)::integer into v_options
  from public.match_time_options as mto where mto.match_id = v_match;

  perform pg_temp.assert_true(
    (select m.selected_time_option_id from public.matches as m where m.id = v_match)
      = v_before
    and v_options = 1,
    'confirming the agreed hour must not churn the time options'
  );
end;
$$;

select pass('recording the agreed hour leaves the time untouched');

-- ---------------------------------------------------------------------------
-- Everyone else is told the match moved
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_agreed timestamptz := now() + interval '7 days';
  v_club_hour timestamptz := now() + interval '7 days 2 hours';
  v_match uuid;
  v_title text;
  v_body text;
  v_changed boolean;
begin
  v_match := pg_temp.ready_match(v_creator, v_joiner, 'fixed', v_agreed);

  perform public.confirm_external_court(
    v_match, v_court, v_club_hour, v_club_hour + interval '90 minutes', null
  );

  select n.payload ->> 'title', n.payload ->> 'body'
  into v_title, v_body
  from public.notifications as n
  where n.entity_id = v_match
    and n.kind = 'match_court_confirmed'
    and n.user_id = v_joiner
  order by n.created_at desc
  limit 1;

  select (ae.metadata ->> 'time_changed')::boolean
  into v_changed
  from public.audit_events as ae
  where ae.entity_id = v_match
    and ae.action = 'court_arranged_externally'
  order by ae.created_at desc
  limit 1;

  -- A moved hour is the part someone skimming a push must not miss.
  perform pg_temp.assert_true(
    v_title = 'Court confirmed, time changed',
    format('the notice title must flag the move, got %s', v_title)
  );

  perform pg_temp.assert_true(
    v_body like '%Moved from%' and v_body like '%Pilot Tennis Club%',
    format('the notice must name the club and the old hour, got %s', v_body)
  );

  perform pg_temp.assert_true(
    v_changed,
    'the audit trail must record that the time moved'
  );
end;
$$;

select pass('participants are told when the court moved the match');

-- ---------------------------------------------------------------------------
-- A real court outranks the poll
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_agreed timestamptz := now() + interval '8 days';
  v_club_hour timestamptz := now() + interval '8 days 3 hours';
  v_match uuid;
  v_option uuid;
begin
  v_match := pg_temp.ready_match(v_creator, v_joiner, 'flexible', v_agreed);

  -- Both vote the slot through so the match reaches ready_to_book.
  select mto.id into v_option
  from public.match_time_options as mto
  where mto.match_id = v_match and mto.withdrawn_at is null
  limit 1;

  perform pg_temp.set_caller(v_creator);
  perform public.cast_match_time_vote(v_match, v_option, 'yes'::public.vote_value);
  perform pg_temp.set_caller(v_joiner);
  perform public.cast_match_time_vote(v_match, v_option, 'yes'::public.vote_value);

  perform pg_temp.assert_true(
    (select m.status from public.matches as m where m.id = v_match) = 'ready_to_book',
    'a unanimous flexible match should be ready_to_book'
  );

  -- Re-syncing withdraws the option they voted on. Without the court-aware
  -- promotion the vote check would demote this straight back to full.
  perform public.confirm_external_court(
    v_match, v_court, v_club_hour, v_club_hour + interval '90 minutes', null
  );

  perform pg_temp.assert_true(
    (select m.status from public.matches as m where m.id = v_match) = 'confirmed',
    format(
      'a booked court must outrank the poll, got %s',
      (select m.status from public.matches as m where m.id = v_match)
    )
  );
end;
$$;

select pass('a booked court outranks the vote on a flexible match');

select * from finish();

rollback;
