\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(6);

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

-- An in_progress match with two accepted players, reached the way a real one
-- is: publish in the future, backdate the slot, then answer the played prompt.
create or replace function pg_temp.played_match(p_a uuid, p_b uuid)
returns uuid
language plpgsql
as $$
declare
  v_match uuid;
  v_old uuid;
begin
  perform pg_temp.set_caller(p_a);

  for v_old in
    select lm.match_id from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft','open','full','ready_to_book','booking_pending','confirmed','in_progress')
  loop
    begin
      perform public.cancel_match(v_old, 'test cleanup');
    exception when others then null;
    end;
  end loop;

  v_match := public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'beginner'::public.skill_band,
    'competitive'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(jsonb_build_object(
      'starts_at', (now() + interval '3 days')::text,
      'ends_at', (now() + interval '3 days 90 minutes')::text)),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]);

  perform pg_temp.set_caller(p_b);
  perform public.join_match(v_match);

  update public.match_time_options
  set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours'
  where match_id = v_match;

  perform pg_temp.set_caller(p_a);
  perform public.report_match_played(v_match, true);

  return v_match;
end;
$$;

-- ---------------------------------------------------------------------------
-- Declining is per participant, and does not speak for the other player
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid := '11111111-1111-1111-1111-111111111111';
  v_b uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_declined timestamptz;
begin
  v_match := pg_temp.played_match(v_a, v_b);

  perform pg_temp.set_caller(v_a);
  v_declined := public.decline_match_score(v_match);

  perform pg_temp.assert_true(
    v_declined is not null,
    'declining should record when it was said'
  );

  perform pg_temp.assert_true(
    public.get_own_score_declined(v_match) is not null,
    'the player who declined should read their own decline back'
  );

  -- The whole reason this is per participant rather than per match.
  perform pg_temp.set_caller(v_b);
  perform pg_temp.assert_true(
    public.get_own_score_declined(v_match) is null,
    'one player declining must not mark the other as having declined'
  );

  perform public.submit_match_result(
    v_match,
    '{"sets": [[6,4],[4,6],[6,3]]}'::jsonb,
    array[v_b]::uuid[]
  );

  perform pg_temp.assert_true(
    exists (select 1 from public.match_results as mr where mr.match_id = v_match),
    'the other player must still be able to submit a score afterwards'
  );
end;
$$;

select pass('declining records a timestamp for the caller alone');
select pass('the other player is unaffected');
select pass('the other player can still submit a score');

-- ---------------------------------------------------------------------------
-- Reversible, and refused once a score exists
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid := '11111111-1111-1111-1111-111111111111';
  v_b uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_message text;
begin
  v_match := pg_temp.played_match(v_a, v_b);

  perform pg_temp.set_caller(v_a);
  perform public.decline_match_score(v_match);

  -- A player who declines and then remembers the score is not stuck.
  perform pg_temp.assert_true(
    public.decline_match_score(v_match, false) is null,
    'clearing a decline should return it to not stated'
  );

  perform pg_temp.assert_true(
    public.get_own_score_declined(v_match) is null,
    'a cleared decline should read back as not stated'
  );

  perform public.submit_match_result(
    v_match,
    '{"sets": [[6,4],[6,3]]}'::jsonb,
    array[v_a]::uuid[]
  );

  -- Once a score is in, confirm or dispute it -- declining is meaningless.
  begin
    perform public.decline_match_score(v_match);
    raise exception 'expected decline_match_score to refuse once a result exists';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_message = message_text;
      perform pg_temp.assert_true(
        v_message = 'result_already_exists',
        'refusal should name the existing result, got: ' || v_message
      );
  end;
end;
$$;

select pass('a decline can be taken back');
select pass('declining is refused once a score exists');

select is(
  has_function_privilege('anon', 'public.decline_match_score(uuid, boolean)', 'EXECUTE'),
  false,
  'anonymous callers cannot decline a score'
);

select * from finish();

rollback;
