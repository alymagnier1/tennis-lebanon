\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(8);

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
      and lm.status in (
        'draft', 'open', 'full', 'ready_to_book', 'booking_pending',
        'confirmed', 'in_progress'
      )
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

-- A match at in_progress with no booking, which is the shape 048 made ordinary
-- and the shape most casual pilot matches will have. The agreed hour is
-- backdated by p_hours_ago so the grace-window tests can steer it.
create or replace function pg_temp.played_match(
  p_creator uuid,
  p_joiners uuid[],
  p_format public.match_format default 'singles',
  p_hours_ago integer default 5
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_joiner uuid;
begin
  perform pg_temp.clear_hosted(p_creator);

  v_match_id := public.create_and_publish_match(
    p_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'beginner'::public.skill_band,
    'competitive'::public.skill_band,
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

  foreach v_joiner in array p_joiners
  loop
    perform pg_temp.set_caller(v_joiner);
    perform public.join_match(v_match_id);
  end loop;

  update public.match_time_options
  set starts_at = now() - make_interval(hours => p_hours_ago),
      ends_at = now() - make_interval(hours => p_hours_ago - 2)
  where match_id = v_match_id;

  perform pg_temp.set_caller(p_creator);
  perform public.report_match_played(v_match_id, true);

  return v_match_id;
end;
$$;

create or replace function pg_temp.match_status(p_match_id uuid)
returns text
language sql
as $$
  select m.status::text from public.matches as m where m.id = p_match_id;
$$;

create or replace function pg_temp.result_status(p_match_id uuid)
returns text
language sql
as $$
  select mr.status::text from public.match_results as mr where mr.match_id = p_match_id;
$$;

-- updated_at is written by a BEFORE UPDATE trigger, so ageing a result into the
-- stale window needs the trigger out of the way.
create or replace function pg_temp.age_result(p_match_id uuid, p_hours integer)
returns void
language plpgsql
as $$
begin
  alter table public.match_results disable trigger results_updated_at;
  update public.match_results
  set updated_at = now() - make_interval(hours => p_hours)
  where match_id = p_match_id;
  alter table public.match_results enable trigger results_updated_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. A tennis set is legal or not; who won it is a separate question
-- ---------------------------------------------------------------------------

do $$
declare
  v_error text;
begin
  perform pg_temp.assert_true(
    public.is_valid_tennis_set(6, 4) and public.is_valid_tennis_set(4, 6),
    'a legal set must be legal whichever side won it'
  );

  perform pg_temp.assert_true(
    public.is_valid_tennis_set(7, 6) and public.is_valid_tennis_set(6, 7),
    'tiebreak sets must be accepted either way round'
  );

  perform pg_temp.assert_true(
    not public.is_valid_tennis_set(6, 5)
      and not public.is_valid_tennis_set(6, 6)
      and not public.is_valid_tennis_set(5, 4),
    'impossible set scores must be rejected'
  );

  -- The defect the format change exists to fix: the winner dropping a set.
  perform pg_temp.assert_true(
    public.derive_score_winner_side(
      '{"sets":[[6,4],[4,6],[6,3]]}'::jsonb
    ) = 1,
    'a three-setter must be recordable and resolve to side A'
  );

  perform pg_temp.assert_true(
    public.derive_score_winner_side(
      '{"sets":[[4,6],[6,4],[3,6]]}'::jsonb
    ) = 2,
    'the same three-setter reversed must resolve to side B'
  );

  begin
    perform public.derive_score_winner_side('{"sets":[[6,4],[4,6]]}'::jsonb);
    v_error := 'no error';
  exception
    when others then v_error := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_error = 'score_has_no_winner',
    format('level sets must have no winner, got %s', v_error)
  );

  begin
    perform public.validate_match_score('{"sets":[["a","b"]]}'::jsonb);
    v_error := 'no error';
  exception
    when others then v_error := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_error = 'score_set_not_numeric',
    format('non-numeric games must be rejected, got %s', v_error)
  );

  begin
    perform public.validate_match_score('{"sets":[]}'::jsonb);
    v_error := 'no error';
  exception
    when others then v_error := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_error = 'score_set_count',
    format('an empty score must be rejected, got %s', v_error)
  );
end;
$$;

select pass('score validation is symmetric and rejects malformed payloads');

-- ---------------------------------------------------------------------------
-- 2. Everyone answering completes the match, with no score involved
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.played_match(v_creator, array[v_joiner]);

  perform pg_temp.set_caller(v_creator);
  perform public.record_match_attendance(v_match, 'attended');

  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'in_progress',
    'one answer must not complete the match on its own'
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.record_match_attendance(v_match, 'attended');

  -- The whole point of the milestone: a casual match that nobody scored still
  -- reaches completed, and so still counts.
  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'completed',
    format(
      'both answers should complete the match, got %s',
      pg_temp.match_status(v_match)
    )
  );

  perform pg_temp.assert_true(
    pg_temp.result_status(v_match) is null,
    'completing by attendance must not invent a result'
  );

  perform pg_temp.assert_true(
    exists (
      select 1 from public.audit_events as ae
      where ae.entity_id = v_match
        and ae.action = 'match_completed_by_attendance'
    ),
    'completing by attendance must be recorded, not silent'
  );
end;
$$;

select pass('mutual attendance completes a match with no score');

-- ---------------------------------------------------------------------------
-- 3. Everyone saying they did not play closes it instead
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.played_match(v_creator, array[v_joiner]);

  perform pg_temp.set_caller(v_creator);
  perform public.record_match_attendance(v_match, 'no_show');
  perform pg_temp.set_caller(v_joiner);
  perform public.record_match_attendance(v_match, 'no_show');

  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'expired',
    format(
      'a match nobody played must not complete, got %s',
      pg_temp.match_status(v_match)
    )
  );
end;
$$;

select pass('a match nobody attended expires rather than completing');

-- ---------------------------------------------------------------------------
-- 4. One answer plus the grace window is enough
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_recent uuid;
  v_stale uuid;
begin
  -- Inside the window: one answer, still waiting on the other.
  v_recent := pg_temp.played_match(v_creator, array[v_joiner], 'singles', 5);
  perform pg_temp.set_caller(v_creator);
  perform public.record_match_attendance(v_recent, 'attended');
  perform public.complete_matches_from_attendance();

  perform pg_temp.assert_true(
    pg_temp.match_status(v_recent) = 'in_progress',
    'a recent half-answered match must keep waiting'
  );

  -- Past it: the silent player is not a reason to lose the match.
  v_stale := pg_temp.played_match(v_creator, array[v_joiner], 'singles', 100);
  perform pg_temp.set_caller(v_creator);
  perform public.record_match_attendance(v_stale, 'attended');
  perform public.complete_matches_from_attendance();

  perform pg_temp.assert_true(
    pg_temp.match_status(v_stale) = 'completed',
    format(
      'a stale half-answered match should complete, got %s',
      pg_temp.match_status(v_stale)
    )
  );
end;
$$;

select pass('one attendance completes the match once the grace window passes');

-- ---------------------------------------------------------------------------
-- 5. The score is optional, addable after completion, and derives its winner
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_result public.match_results%rowtype;
  v_error text;
begin
  v_match := pg_temp.played_match(v_creator, array[v_joiner]);

  perform pg_temp.set_caller(v_creator);
  perform public.record_match_attendance(v_match, 'attended');
  perform pg_temp.set_caller(v_joiner);
  perform public.record_match_attendance(v_match, 'attended');

  perform pg_temp.assert_true(
    pg_temp.match_status(v_match) = 'completed',
    'precondition: the match completed on attendance'
  );

  -- Submitting on a completed match has to work, or the optional score becomes
  -- unreachable the moment attendance lands.
  perform pg_temp.set_caller(v_creator);
  perform public.submit_match_result(
    v_match,
    '{"sets":[[6,4],[4,6],[6,3]]}'::jsonb,
    array[v_creator]::uuid[]
  );

  select * into v_result from public.match_results where match_id = v_match;

  perform pg_temp.assert_true(
    v_result.winning_side = 1 and v_result.winner_user_id = v_creator,
    'the winner must be derived from the score, not supplied'
  );

  perform pg_temp.assert_true(
    v_result.revision = 1 and v_result.status = 'submitted',
    'a fresh result starts at revision 1, awaiting the other side'
  );

  -- The submitter naming the opposing side does not make them the winner: the
  -- sets decide. This is what the removed winner parameter used to allow.
  perform pg_temp.assert_true(
    (
      select mr.winner_user_id
      from public.match_results as mr
      where mr.match_id = v_match
    ) <> v_joiner,
    'a losing score must not produce the submitter as winner'
  );

  begin
    perform public.submit_match_result(
      v_match, '{"sets":[[6,4]]}'::jsonb, array[v_creator]::uuid[]
    );
    v_error := 'no error';
  exception
    when others then v_error := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_error = 'A result already exists for this match',
    format('one result per match must hold, got %s', v_error)
  );
end;
$$;

select pass('a score is optional, addable after completion, and self-derives its winner');

-- ---------------------------------------------------------------------------
-- 6. Silence confirms only from someone the push actually reached
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_reached uuid;
  v_unreachable uuid;
  v_ratings integer;
begin
  -- Reached: the opponent was told and said nothing.
  v_reached := pg_temp.played_match(v_creator, array[v_joiner]);
  perform pg_temp.set_caller(v_creator);
  perform public.submit_match_result(
    v_reached, '{"sets":[[6,4],[6,3]]}'::jsonb, array[v_creator]::uuid[]
  );

  update public.notifications
  set sent_at = now()
  where entity_id = v_reached
    and kind = 'result_confirm_request';

  perform pg_temp.age_result(v_reached, 80);
  perform public.resolve_stale_results();

  perform pg_temp.assert_true(
    pg_temp.result_status(v_reached) = 'confirmed',
    format(
      'a delivered notice plus silence should confirm, got %s',
      pg_temp.result_status(v_reached)
    )
  );

  perform pg_temp.assert_true(
    (
      select mr.confirmed_by from public.match_results as mr
      where mr.match_id = v_reached
    ) is null,
    'an auto-confirmation must stay distinguishable from a tap'
  );

  select count(*)::integer into v_ratings
  from public.rating_events as re
  join public.match_results as mr on mr.id = re.result_id
  where mr.match_id = v_reached;

  perform pg_temp.assert_true(
    v_ratings = 2,
    format('an auto-confirmed singles result should rate both players, got %s', v_ratings)
  );

  -- Unreachable: nobody ever saw the claim, so silence means nothing.
  v_unreachable := pg_temp.played_match(v_creator, array[v_joiner]);
  perform pg_temp.set_caller(v_creator);
  perform public.submit_match_result(
    v_unreachable, '{"sets":[[6,2],[6,1]]}'::jsonb, array[v_creator]::uuid[]
  );

  perform pg_temp.age_result(v_unreachable, 80);
  perform public.resolve_stale_results();

  perform pg_temp.assert_true(
    pg_temp.result_status(v_unreachable) = 'unverified',
    format(
      'an undelivered notice must not confirm by silence, got %s',
      pg_temp.result_status(v_unreachable)
    )
  );

  perform pg_temp.assert_true(
    not exists (
      select 1
      from public.rating_events as re
      join public.match_results as mr on mr.id = re.result_id
      where mr.match_id = v_unreachable
    ),
    'an unverified result must never move a rating'
  );
end;
$$;

select pass('silence confirms only when the notice was delivered');

-- ---------------------------------------------------------------------------
-- 7. Disagreeing hands the pen over, once
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_result public.match_results%rowtype;
  v_error text;
begin
  v_match := pg_temp.played_match(v_creator, array[v_joiner]);

  perform pg_temp.set_caller(v_creator);
  perform public.submit_match_result(
    v_match, '{"sets":[[6,4],[6,3]]}'::jsonb, array[v_creator]::uuid[]
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.dispute_match_result(v_match, 'that was my win');

  perform pg_temp.assert_true(
    pg_temp.result_status(v_match) = 'disputed',
    'disagreeing must park the result'
  );

  -- The submitter cannot seize the reopen.
  perform pg_temp.set_caller(v_creator);
  begin
    perform public.resubmit_match_result(
      v_match, '{"sets":[[6,0]]}'::jsonb, array[v_creator]::uuid[]
    );
    v_error := 'no error';
  exception
    when others then v_error := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_error = 'result_not_your_dispute',
    format('only the disputer may correct, got %s', v_error)
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.resubmit_match_result(
    v_match, '{"sets":[[4,6],[3,6]]}'::jsonb, array[v_creator]::uuid[]
  );

  select * into v_result from public.match_results where match_id = v_match;

  perform pg_temp.assert_true(
    v_result.status = 'submitted'
      and v_result.revision = 2
      and v_result.submitted_by = v_joiner
      and v_result.winner_user_id = v_joiner,
    'the correction becomes the pending result, owned by its author'
  );

  perform pg_temp.assert_true(
    v_result.dispute_note = 'that was my win',
    'the original objection survives for the operator queue'
  );

  -- A second disagreement is a real conflict; operations owns it from here.
  perform pg_temp.set_caller(v_creator);
  perform public.dispute_match_result(v_match, 'still wrong');

  perform pg_temp.set_caller(v_creator);
  begin
    perform public.resubmit_match_result(
      v_match, '{"sets":[[6,0]]}'::jsonb, array[v_creator]::uuid[]
    );
    v_error := 'no error';
  exception
    when others then v_error := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_error = 'result_already_reopened',
    format('the reopen is available once only, got %s', v_error)
  );

  perform pg_temp.assert_true(
    not exists (
      select 1
      from public.rating_events as re
      join public.match_results as mr on mr.id = re.result_id
      where mr.match_id = v_match
    ),
    'nothing in a dispute may move a rating'
  );
end;
$$;

select pass('a disagreement reopens once, then belongs to operations');

-- ---------------------------------------------------------------------------
-- 8. Doubles: a partner cannot rubber-stamp their own team's claim
-- ---------------------------------------------------------------------------

do $$
declare
  -- Player A blocks Player C in the seed, so the partner here is Player H.
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_partner uuid := '12121212-1212-1212-1212-121212121212';
  v_opponent_a uuid := '88888888-8888-8888-8888-888888888888';
  v_opponent_b uuid := '10101010-1010-1010-1010-101010101010';
  v_match uuid;
  v_error text;
begin
  v_match := pg_temp.played_match(
    v_creator,
    array[v_partner, v_opponent_a, v_opponent_b],
    'doubles'
  );

  perform pg_temp.set_caller(v_creator);
  perform public.submit_match_result(
    v_match,
    '{"sets":[[6,4],[6,3]]}'::jsonb,
    array[v_creator, v_partner]::uuid[]
  );

  -- Before sides existed on the result, any of the other three could confirm,
  -- which in doubles meant the submitter's own partner.
  perform pg_temp.set_caller(v_partner);
  begin
    perform public.confirm_match_result(v_match);
    v_error := 'no error';
  exception
    when others then v_error := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_error = 'result_same_side_actor',
    format('a partner must not confirm their own side, got %s', v_error)
  );

  perform pg_temp.set_caller(v_opponent_a);
  perform public.confirm_match_result(v_match);

  perform pg_temp.assert_true(
    pg_temp.result_status(v_match) = 'confirmed',
    'one opposing player is enough to confirm'
  );

  -- Doubles stays unrated by design (docs/DATABASE.md).
  perform pg_temp.assert_true(
    not exists (
      select 1
      from public.rating_events as re
      join public.match_results as mr on mr.id = re.result_id
      where mr.match_id = v_match
    ),
    'doubles must remain unrated'
  );
end;
$$;

select pass('doubles needs an opponent to confirm, not a teammate');

select * from finish();

rollback;
