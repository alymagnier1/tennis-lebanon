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

-- A full singles match at ready_to_book whose agreed hour has already gone by,
-- with no court ever recorded. create_and_publish_match refuses a past time, so
-- the option is backdated afterwards.
create or replace function pg_temp.stranded_match(
  p_creator uuid,
  p_joiner uuid
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
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  perform pg_temp.set_caller(p_joiner);
  perform public.join_match(v_match_id);
  perform pg_temp.set_caller(p_creator);

  update public.match_time_options
  set starts_at = now() - interval '5 hours',
      ends_at = now() - interval '3 hours'
  where match_id = v_match_id;

  return v_match_id;
end;
$$;

-- Runs as the session role; identity comes from the JWT claim and this file
-- asserts lifecycle behaviour rather than RLS.

-- ---------------------------------------------------------------------------
-- Only a match that had its people and its hour is worth asking about
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.stranded_match(v_creator, v_joiner);

  perform pg_temp.assert_true(
    public.match_awaiting_played_answer(v_match),
    'a full match whose hour passed with no court should be asked about'
  );

  -- There is still a window: expiry does not bite for another day, which is
  -- what makes asking worth doing rather than racing the sweep.
  perform pg_temp.assert_true(
    not public.match_should_expire(v_match),
    'the question must be asked before expiry takes the match'
  );

  -- A live upcoming hour means nothing has been missed yet.
  update public.match_time_options
  set starts_at = now() + interval '2 days',
      ends_at = now() + interval '2 days 90 minutes'
  where match_id = v_match;

  perform pg_temp.assert_true(
    not public.match_awaiting_played_answer(v_match),
    'a match whose hour is still ahead must not be asked about'
  );
end;
$$;

select pass('only a stranded match with a passed hour is asked about');

-- ---------------------------------------------------------------------------
-- Yes puts the match back on the road to completed
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_attendance integer;
begin
  v_match := pg_temp.stranded_match(v_creator, v_joiner);

  perform public.report_match_played(v_match, true);

  perform pg_temp.assert_true(
    (select m.status from public.matches as m where m.id = v_match) = 'in_progress',
    format(
      'a played match should reach in_progress, got %s',
      (select m.status from public.matches as m where m.id = v_match)
    )
  );

  -- No court exists and none is needed: the completed match and the rating are
  -- the objective, and neither depends on a booking.
  perform pg_temp.assert_true(
    not public.match_has_accepted_court(v_match),
    'answering yes must not invent a booking'
  );

  perform public.record_match_attendance(
    v_match, 'attended'::public.attendance_status
  );

  select count(*)::integer into v_attendance
  from public.match_participants as mp
  where mp.match_id = v_match and mp.attendance = 'attended';

  perform pg_temp.assert_true(
    v_attendance = 1,
    'attendance must be recordable on a match played without a court'
  );

  perform pg_temp.assert_true(
    not public.match_awaiting_played_answer(v_match),
    'an answered match must not be asked again'
  );
end;
$$;

select pass('answering yes reaches in_progress and accepts attendance');

-- ---------------------------------------------------------------------------
-- No closes it there and then
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_logged boolean;
begin
  v_match := pg_temp.stranded_match(v_creator, v_joiner);

  perform public.report_match_played(v_match, false);

  perform pg_temp.assert_true(
    (select m.status from public.matches as m where m.id = v_match) = 'expired',
    format(
      'answering no should close the match, got %s',
      (select m.status from public.matches as m where m.id = v_match)
    )
  );

  select exists (
    select 1
    from public.audit_events as ae
    where ae.entity_id = v_match
      and ae.action = 'match_reported_not_played'
  )
  into v_logged;

  perform pg_temp.assert_true(
    v_logged,
    'closing the match by answer must be recorded, not silent'
  );
end;
$$;

select pass('answering no closes the match and records why');

-- ---------------------------------------------------------------------------
-- Only the people who were in it can answer
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_stranger uuid := '14141414-1414-1414-1414-141414141414';
  v_match uuid;
  v_outsider text;
  v_wrong_state text;
begin
  v_match := pg_temp.stranded_match(v_creator, v_joiner);

  perform pg_temp.set_caller(v_stranger);
  begin
    perform public.report_match_played(v_match, true);
    v_outsider := 'no error';
  exception
    when others then
      v_outsider := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_outsider = 'Only a match participant can answer this',
    format('a non-participant must not answer, got %s', v_outsider)
  );

  -- Answering twice, or answering a match that was never stranded.
  perform pg_temp.set_caller(v_creator);
  perform public.report_match_played(v_match, true);

  begin
    perform public.report_match_played(v_match, true);
    v_wrong_state := 'no error';
  exception
    when others then
      v_wrong_state := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_wrong_state = 'match_not_awaiting_played_answer',
    format('answering an already-answered match must fail, got %s', v_wrong_state)
  );
end;
$$;

select pass('only participants can answer, and only once');

-- ---------------------------------------------------------------------------
-- The question reaches everyone who was in the match, once
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_first integer;
  v_body text;
  v_attendance_pushes integer;
begin
  v_match := pg_temp.stranded_match(v_creator, v_joiner);

  v_first := public.match_played_prompts();

  perform pg_temp.assert_true(
    v_first >= 2,
    format('both participants should be asked, got %s', v_first)
  );

  perform pg_temp.assert_true(
    public.match_played_prompts() = 0,
    'the question must not be asked again on the next sweep'
  );

  select n.payload ->> 'body'
  into v_body
  from public.notifications as n
  where n.entity_id = v_match
    and n.kind = 'match_played_prompt'
  limit 1;

  perform pg_temp.assert_true(
    v_body like '%never got a court%',
    format('the prompt should say why it is asking, got %s', v_body)
  );

  -- 024 joined onto accepted bookings, so a self-reported match would have got
  -- no attendance push at all -- the very answer the prompt exists to collect.
  perform public.report_match_played(v_match, true);
  v_attendance_pushes := public.schedule_attendance_prompts();

  perform pg_temp.assert_true(
    v_attendance_pushes >= 2,
    format(
      'attendance prompts must reach a match with no booking, got %s',
      v_attendance_pushes
    )
  );
end;
$$;

select pass('the question and the attendance follow-up both reach everyone');

select * from finish();

rollback;
