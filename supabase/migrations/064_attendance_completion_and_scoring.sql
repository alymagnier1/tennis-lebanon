-- Milestone 9, part 2 of 2: a match completes when the people who played say
-- they played, and a score that nobody can enter stops being the price of it.
--
-- Three things were wrong, and they compound.
--
-- 1. Only confirm_match_result and dispute_match_result ever wrote `completed`
--    (023:290, 023:342). So a casual pair who turned up, hit for an hour and
--    went home without filing a scoreline left a match sitting in_progress
--    forever, counted nowhere. The north-star metric is completed matches; the
--    ordinary casual match could not reach it.
--
-- 2. Nothing swept `submitted`. The opponent was never even told a result was
--    waiting -- no notification kind existed -- so "awaiting confirmation" was a
--    state you entered and never left.
--
-- 3. The score format could not express a tennis match. Sets were stored from
--    the winner's perspective and isValidTennisSet rejected any set the declared
--    winner had lost (packages/domain/src/results.ts:51), so 6-4, 4-6, 6-3 --
--    an ordinary three-setter -- was unrecordable. The server meanwhile took the
--    winner as a parameter and never checked it against the score, and validated
--    the score itself only as "sets is a non-empty array" (023:123).
--
-- The shape after this: attendance completes the match. A score is optional,
-- can be entered by one person before or after completion, is shown attributed
-- until agreed, and only an agreed score moves a rating. Sets are stored
-- side-relative so both the dropped set and the derived winner fall out of the
-- same change.
--
-- Deliberately not here: no rating tuning (K, seeds, damping all stay as
-- shipped), no doubles rating, no adjudication machinery. A disputed result
-- still goes to the operator queue built in 026, and the only resolution that
-- has ever been available there -- void -- remains the right one, because with
-- no referee there is nothing to weigh.

-- ---------------------------------------------------------------------------
-- 1. Side-relative scores
-- ---------------------------------------------------------------------------
--
-- `side_a_user_ids` names one side; the other is every other accepted
-- participant. Sets read [sideAGames, sideBGames], so a set either side won is
-- representable and the winner is a count rather than a claim.
--
-- `winning_side` carries the derivation. `winner_user_id` stays and stays
-- meaningful -- apply_rating_for_result reads it and is singles-only, where the
-- winning side has exactly one member -- but it is now written by the server
-- from the score rather than accepted from the caller.

alter table public.match_results
  add column if not exists side_a_user_ids uuid[],
  add column if not exists winning_side smallint,
  add column if not exists revision smallint not null default 1,
  add column if not exists disputed_by uuid references public.profiles(id);

-- Existing rows are winner-perspective, so side A is the winner's side and the
-- stored sets already read in that orientation. Nothing has to be rewritten,
-- only labelled.
update public.match_results
set
  side_a_user_ids = coalesce(side_a_user_ids, array_remove(array[winner_user_id], null)),
  winning_side = coalesce(winning_side, 1)
where side_a_user_ids is null
   or winning_side is null;

alter table public.match_results
  alter column side_a_user_ids set not null,
  alter column winning_side set not null;

do $constraint$
begin
  alter table public.match_results
    add constraint match_results_winning_side_valid
    check (winning_side in (1, 2));
exception
  when duplicate_object then null;
end;
$constraint$;

do $constraint$
begin
  alter table public.match_results
    add constraint match_results_revision_valid
    check (revision between 1 and 2);
exception
  when duplicate_object then null;
end;
$constraint$;

-- ---------------------------------------------------------------------------
-- 2. What a tennis set is, in SQL
-- ---------------------------------------------------------------------------
--
-- Mirrors packages/domain/src/results.ts so the client can keep validating for
-- immediate feedback while the server remains the authority. Unlike the old
-- client rule this is symmetric: it asks whether the set is a legal score, not
-- whether a particular player won it.

create or replace function public.is_valid_tennis_set(p_a integer, p_b integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_a is not null
     and p_b is not null
     and p_a >= 0
     and p_b >= 0
     and (
       (greatest(p_a, p_b) = 6 and least(p_a, p_b) <= 4)
       or (greatest(p_a, p_b) = 7 and least(p_a, p_b) in (5, 6))
     );
$$;

-- Returns {sets_won_by_side_a, sets_won_by_side_b}. Raises rather than returning
-- null so every caller fails loudly on a malformed payload.
create or replace function public.validate_match_score(p_score jsonb)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sets jsonb;
  v_set jsonb;
  v_num_a numeric;
  v_num_b numeric;
  v_a integer;
  v_b integer;
  v_won_a integer := 0;
  v_won_b integer := 0;
  v_count integer;
begin
  if p_score is null or jsonb_typeof(p_score) <> 'object' then
    raise exception using errcode = 'P0001', message = 'score_invalid';
  end if;

  v_sets := p_score -> 'sets';

  if v_sets is null or jsonb_typeof(v_sets) <> 'array' then
    raise exception using errcode = 'P0001', message = 'score_missing_sets';
  end if;

  v_count := jsonb_array_length(v_sets);
  if v_count < 1 or v_count > 5 then
    raise exception using errcode = 'P0001', message = 'score_set_count';
  end if;

  for v_set in select value from jsonb_array_elements(v_sets)
  loop
    if jsonb_typeof(v_set) <> 'array' or jsonb_array_length(v_set) <> 2 then
      raise exception using errcode = 'P0001', message = 'score_set_shape';
    end if;

    if jsonb_typeof(v_set -> 0) <> 'number'
       or jsonb_typeof(v_set -> 1) <> 'number' then
      raise exception using errcode = 'P0001', message = 'score_set_not_numeric';
    end if;

    v_num_a := (v_set ->> 0)::numeric;
    v_num_b := (v_set ->> 1)::numeric;

    if v_num_a <> trunc(v_num_a) or v_num_b <> trunc(v_num_b) then
      raise exception using errcode = 'P0001', message = 'score_set_not_integer';
    end if;

    v_a := v_num_a::integer;
    v_b := v_num_b::integer;

    if not public.is_valid_tennis_set(v_a, v_b) then
      raise exception using errcode = 'P0001', message = 'score_set_invalid';
    end if;

    if v_a > v_b then
      v_won_a := v_won_a + 1;
    else
      v_won_b := v_won_b + 1;
    end if;
  end loop;

  return array[v_won_a, v_won_b];
end;
$$;

-- 1 or 2. A match with the sets split evenly has no winner and is not a result
-- this app records -- retirements and walkovers are an operations rule, per
-- docs/DATABASE.md.
create or replace function public.derive_score_winner_side(p_score jsonb)
returns smallint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_tally integer[];
begin
  v_tally := public.validate_match_score(p_score);

  if v_tally[1] = v_tally[2] then
    raise exception using errcode = 'P0001', message = 'score_has_no_winner';
  end if;

  return case when v_tally[1] > v_tally[2] then 1 else 2 end;
end;
$$;

revoke all on function public.is_valid_tennis_set(integer, integer) from public, anon;
revoke all on function public.validate_match_score(jsonb) from public, anon;
revoke all on function public.derive_score_winner_side(jsonb) from public, anon;
grant execute on function public.is_valid_tennis_set(integer, integer) to authenticated;
grant execute on function public.validate_match_score(jsonb) to authenticated;
grant execute on function public.derive_score_winner_side(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. When the match happened, and how long a score stays enterable
-- ---------------------------------------------------------------------------
--
-- The booked hour if there is one, the agreed hour otherwise. Same expression
-- schedule_attendance_prompts settled on in 048:307-314, which had to stop
-- depending on a booking once matches could be self-reported as played.

create or replace function public.match_outcome_reference_at(p_match_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select b.starts_at
      from public.bookings as b
      where b.match_id = p_match_id
        and b.status = 'accepted'
      order by b.created_at desc
      limit 1
    ),
    (
      select mto.starts_at
      from public.matches as m
      join public.match_time_options as mto
        on mto.id = m.selected_time_option_id
      where m.id = p_match_id
    )
  );
$$;

-- A score can be added long after the match completes -- that is the point of
-- making it optional -- but not indefinitely, or every finished match keeps
-- "add the score" as its standing next action. Unknown reference means open:
-- being too strict here rebuilds exactly the dead end this milestone removes.
create or replace function public.match_result_entry_open(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.match_outcome_reference_at(p_match_id) > now() - interval '7 days',
    true
  );
$$;

revoke all on function public.match_outcome_reference_at(uuid) from public, anon;
revoke all on function public.match_result_entry_open(uuid) from public, anon;
grant execute on function public.match_outcome_reference_at(uuid) to authenticated;
grant execute on function public.match_result_entry_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Sides
-- ---------------------------------------------------------------------------

-- Every accepted participant not on side A.
create or replace function public.match_side_b_user_ids(
  p_match_id uuid,
  p_side_a_user_ids uuid[]
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(mp.user_id order by mp.user_id), '{}'::uuid[])
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.status = 'accepted'
    and not (mp.user_id = any(p_side_a_user_ids));
$$;

-- 1 if the player is on side A, 2 otherwise. Only meaningful for an accepted
-- participant of that match.
create or replace function public.match_result_side_for_user(
  p_result_id uuid,
  p_user_id uuid
)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user_id = any(mr.side_a_user_ids) then 1::smallint
    else 2::smallint
  end
  from public.match_results as mr
  where mr.id = p_result_id;
$$;

-- Both submit and resubmit need the same three things to be true: side A is the
-- right size, everyone named on it is actually an accepted participant, and the
-- remainder makes up an equal side B.
create or replace function public.assert_valid_result_sides(
  p_match_id uuid,
  p_side_a_user_ids uuid[],
  p_format public.match_format
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expected_per_side integer;
begin
  v_expected_per_side := public.match_capacity_for_format(p_format) / 2;

  if p_side_a_user_ids is null
     or cardinality(p_side_a_user_ids) <> v_expected_per_side then
    raise exception using errcode = 'P0001', message = 'result_sides_invalid';
  end if;

  if exists (
    select 1
    from unnest(p_side_a_user_ids) as s
    where not exists (
      select 1
      from public.match_participants as mp
      where mp.match_id = p_match_id
        and mp.user_id = s
        and mp.status = 'accepted'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'result_sides_invalid';
  end if;

  if cardinality(
    public.match_side_b_user_ids(p_match_id, p_side_a_user_ids)
  ) <> v_expected_per_side then
    raise exception using errcode = 'P0001', message = 'result_sides_invalid';
  end if;
end;
$$;

revoke all on function public.match_side_b_user_ids(uuid, uuid[]) from public, anon;
revoke all on function public.match_result_side_for_user(uuid, uuid) from public, anon;
revoke all on function public.assert_valid_result_sides(uuid, uuid[], public.match_format)
  from public, anon;
grant execute on function public.match_side_b_user_ids(uuid, uuid[]) to authenticated;
grant execute on function public.match_result_side_for_user(uuid, uuid) to authenticated;
grant execute on function public.assert_valid_result_sides(uuid, uuid[], public.match_format)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Attendance completes the match
-- ---------------------------------------------------------------------------
--
-- Everybody answered and at least one of them played: the match happened, and
-- that is the whole bar. Everybody answered and nobody played: it did not, and
-- expired is where report_match_played(false) already puts such a match.

create or replace function public.apply_attendance_completion(p_match_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_known integer;
  v_attended integer;
  v_status public.match_status;
begin
  select m.status
  into v_status
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found or v_status <> 'in_progress' then
    return false;
  end if;

  select
    count(*)::integer,
    count(*) filter (where mp.attendance <> 'unknown')::integer,
    count(*) filter (where mp.attendance = 'attended')::integer
  into v_total, v_known, v_attended
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.status = 'accepted';

  if v_total = 0 or v_known < v_total then
    return false;
  end if;

  if v_attended = 0 then
    update public.matches
    set status = 'expired', updated_at = now()
    where id = p_match_id;

    insert into public.audit_events (
      actor_id, action, entity_type, entity_id, metadata
    )
    values (
      null,
      'match_closed_nobody_played',
      'match',
      p_match_id,
      jsonb_build_object('accepted_participants', v_total)
    );

    return true;
  end if;

  update public.matches
  set status = 'completed', updated_at = now()
  where id = p_match_id;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    null,
    'match_completed_by_attendance',
    'match',
    p_match_id,
    jsonb_build_object('attended', v_attended, 'accepted_participants', v_total)
  );

  return true;
end;
$$;

revoke all on function public.apply_attendance_completion(uuid) from public, anon, authenticated;

-- record_match_attendance gains the completion check. Everything above it is
-- unchanged from 023:34.
create or replace function public.record_match_attendance(
  p_match_id uuid,
  p_attendance public.attendance_status
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_status public.match_status;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select m.status
  into v_status
  from public.matches as m
  where m.id = p_match_id;

  if v_status not in ('in_progress', 'completed') then
    raise exception using errcode = 'P0001', message = 'Attendance can only be recorded after the match starts';
  end if;

  if p_attendance not in ('attended', 'no_show', 'late_cancel', 'cancelled_in_time') then
    raise exception using errcode = 'P0001', message = 'Invalid attendance status';
  end if;

  update public.match_participants as mp
  set attendance = p_attendance
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id;

  -- The last answer completes the match there and then, rather than leaving it
  -- to the hourly sweep: the player who just tapped should see it land.
  perform public.apply_attendance_completion(p_match_id);
end;
$$;

-- The partial case. One player answers and the other never opens the app --
-- common, and not a reason to lose the match. After the grace window one
-- confirmed attendance is enough, which mirrors how a submitted score
-- auto-confirms below.
create or replace function public.complete_matches_from_attendance()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_match_id uuid;
begin
  for v_match_id in
    select m.id
    from public.matches as m
    where m.status = 'in_progress'
      and public.match_outcome_reference_at(m.id) < now() - interval '72 hours'
      and exists (
        select 1
        from public.match_participants as mp
        where mp.match_id = m.id
          and mp.status = 'accepted'
          and mp.attendance = 'attended'
      )
  loop
    update public.matches
    set status = 'completed', updated_at = now()
    where id = v_match_id
      and status = 'in_progress';

    if found then
      insert into public.audit_events (
        actor_id, action, entity_type, entity_id, metadata
      )
      values (
        null,
        'match_completed_by_attendance',
        'match',
        v_match_id,
        jsonb_build_object('reason', 'grace_window_elapsed')
      );

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.complete_matches_from_attendance() from public, anon, authenticated;
grant execute on function public.complete_matches_from_attendance() to service_role;

-- ---------------------------------------------------------------------------
-- 6. Submitting a score
-- ---------------------------------------------------------------------------
--
-- The winner parameter is gone. The caller says who was on which side; the
-- server reads the score and decides who won. A caller reaching past the app
-- can no longer name themselves the winner of a match they lost, because the
-- field they used to do it with no longer exists.

drop function if exists public.submit_match_result(uuid, jsonb, uuid);

create or replace function public.submit_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_side_a_user_ids uuid[]
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
  v_result_id uuid;
  v_side_a uuid[];
  v_side_b uuid[];
  v_winning_side smallint;
  v_winner_ids uuid[];
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  -- Attendance now completes the match, so most scores arrive after it. Both
  -- states have to be accepted or the optional score becomes unreachable.
  if v_match.status not in ('in_progress', 'completed') then
    raise exception using errcode = 'P0001', message = 'result_match_not_playable';
  end if;

  if not public.match_result_entry_open(p_match_id) then
    raise exception using errcode = 'P0001', message = 'result_entry_closed';
  end if;

  if exists (
    select 1
    from public.match_results as mr
    where mr.match_id = p_match_id
  ) then
    raise exception using errcode = 'P0001', message = 'A result already exists for this match';
  end if;

  v_side_a := (
    select coalesce(array_agg(distinct s), '{}'::uuid[])
    from unnest(coalesce(p_side_a_user_ids, '{}'::uuid[])) as s
  );
  perform public.assert_valid_result_sides(p_match_id, v_side_a, v_match.format);
  v_side_b := public.match_side_b_user_ids(p_match_id, v_side_a);

  v_winning_side := public.derive_score_winner_side(p_score);
  v_winner_ids := case when v_winning_side = 1 then v_side_a else v_side_b end;

  insert into public.match_results (
    match_id,
    submitted_by,
    status,
    score,
    side_a_user_ids,
    winning_side,
    winner_user_id,
    revision
  )
  values (
    p_match_id,
    v_user_id,
    'submitted',
    p_score,
    v_side_a,
    v_winning_side,
    v_winner_ids[1],
    1
  )
  returning id into v_result_id;

  -- The gap this milestone exists to close: until now nothing told the other
  -- side a score was waiting on them.
  perform public.notify_match_participants(
    p_match_id,
    'result_confirm_request',
    v_user_id,
    format('%s:1', v_result_id)
  );

  return v_result_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Confirming, disagreeing, and the one reopen
-- ---------------------------------------------------------------------------
--
-- Singles has always required the other player. Doubles never had a notion of
-- sides, so any of the other three could confirm -- including the submitter's
-- own partner, rubber-stamping their own team's claim. Sides on the result fix
-- that without a team model on match_participants.

create or replace function public.assert_opposing_side_actor(
  p_result public.match_results,
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_submitter_side smallint;
  v_actor_side smallint;
begin
  v_submitter_side := case
    when p_result.submitted_by = any(p_result.side_a_user_ids) then 1 else 2
  end;
  v_actor_side := case
    when p_user_id = any(p_result.side_a_user_ids) then 1 else 2
  end;

  if v_actor_side = v_submitter_side then
    raise exception using errcode = '42501', message = 'result_same_side_actor';
  end if;
end;
$$;

revoke all on function public.assert_opposing_side_actor(public.match_results, uuid)
  from public, anon;
grant execute on function public.assert_opposing_side_actor(public.match_results, uuid)
  to authenticated;

create or replace function public.confirm_match_result(p_match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_result public.match_results%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select *
  into v_result
  from public.match_results as mr
  where mr.match_id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Result not found';
  end if;

  if v_result.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'Result is not awaiting confirmation';
  end if;

  if v_result.submitted_by = v_user_id then
    raise exception using errcode = '42501', message = 'Submitter cannot confirm their own result';
  end if;

  perform public.assert_opposing_side_actor(v_result, v_user_id);

  update public.match_results as mr
  set
    status = 'confirmed',
    confirmed_by = v_user_id,
    confirmed_at = now(),
    updated_at = now()
  where mr.id = v_result.id;

  -- A confirmed result still completes the match. Attendance is now the usual
  -- route, but an agreed score is at least as good evidence the match happened,
  -- and removing this would regress matches whose players skip the attendance
  -- prompt and go straight to the scoreline.
  update public.matches as m
  set
    status = 'completed',
    updated_at = now()
  where m.id = p_match_id
    and m.status in ('in_progress', 'confirmed');

  perform public.apply_rating_for_result(v_result.id);
end;
$$;

create or replace function public.dispute_match_result(
  p_match_id uuid,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_result public.match_results%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select *
  into v_result
  from public.match_results as mr
  where mr.match_id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Result not found';
  end if;

  if v_result.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'Result is not awaiting confirmation';
  end if;

  if v_result.submitted_by = v_user_id then
    raise exception using errcode = '42501', message = 'Submitter cannot dispute their own result';
  end if;

  perform public.assert_opposing_side_actor(v_result, v_user_id);

  update public.match_results as mr
  set
    status = 'disputed',
    disputed_by = v_user_id,
    dispute_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where mr.id = v_result.id;

  -- Per docs/DECISIONS.md 2026-07-25, a disputed result does not flip match
  -- status: the match stays completed and the dispute lives on the result.
  update public.matches as m
  set
    status = 'completed',
    updated_at = now()
  where m.id = p_match_id
    and m.status in ('in_progress', 'confirmed');
end;
$$;

-- Disagreeing hands the pen to the person who disagreed, once. Most of these
-- are a transposed set or the wrong pairing tapped, and the two players can
-- settle it between them without an operator ever seeing it. A second
-- disagreement is a real conflict and goes to the queue.
create or replace function public.resubmit_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_side_a_user_ids uuid[]
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
  v_result public.match_results%rowtype;
  v_side_a uuid[];
  v_side_b uuid[];
  v_winning_side smallint;
  v_winner_ids uuid[];
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  select *
  into v_result
  from public.match_results as mr
  where mr.match_id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Result not found';
  end if;

  if v_result.status <> 'disputed' then
    raise exception using errcode = 'P0001', message = 'result_not_disputed';
  end if;

  if v_result.revision >= 2 then
    raise exception using errcode = 'P0001', message = 'result_already_reopened';
  end if;

  if v_result.disputed_by is distinct from v_user_id then
    raise exception using errcode = '42501', message = 'result_not_your_dispute';
  end if;

  v_side_a := (
    select coalesce(array_agg(distinct s), '{}'::uuid[])
    from unnest(coalesce(p_side_a_user_ids, '{}'::uuid[])) as s
  );
  perform public.assert_valid_result_sides(p_match_id, v_side_a, v_match.format);
  v_side_b := public.match_side_b_user_ids(p_match_id, v_side_a);

  v_winning_side := public.derive_score_winner_side(p_score);
  v_winner_ids := case when v_winning_side = 1 then v_side_a else v_side_b end;

  -- dispute_note survives on purpose: if this comes back disputed, the operator
  -- wants the original objection as well as the correction.
  update public.match_results as mr
  set
    status = 'submitted',
    score = p_score,
    side_a_user_ids = v_side_a,
    winning_side = v_winning_side,
    winner_user_id = v_winner_ids[1],
    submitted_by = v_user_id,
    revision = 2,
    disputed_by = null,
    updated_at = now()
  where mr.id = v_result.id;

  perform public.notify_match_participants(
    p_match_id,
    'result_confirm_request',
    v_user_id,
    format('%s:2', v_result.id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Silence
-- ---------------------------------------------------------------------------
--
-- Silence is read as agreement only from someone the notification actually
-- reached. `notifications.sent_at` is the evidence: a player with no working
-- device token never saw the claim, and treating their silence as a yes is the
-- one way this could be turned into a weapon. Those results land on
-- `unverified` instead -- visible, attributed, unrated.
--
-- confirmed_by stays null on this path, so an auto-confirmation is always
-- distinguishable from a person tapping the button.

create or replace function public.resolve_stale_results()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_confirmed integer := 0;
  v_unverified integer := 0;
  v_row record;
  v_reached boolean;
begin
  for v_row in
    select
      mr.id,
      mr.match_id,
      mr.revision,
      mr.side_a_user_ids,
      mr.submitted_by
    from public.match_results as mr
    where mr.status = 'submitted'
      and mr.updated_at < now() - interval '72 hours'
    for update
  loop
    select exists (
      select 1
      from public.notifications as n
      join public.match_participants as mp
        on mp.user_id = n.user_id
       and mp.match_id = v_row.match_id
       and mp.status = 'accepted'
      where n.entity_id = v_row.match_id
        and n.kind = 'result_confirm_request'
        and n.sent_at is not null
        and n.deduplication_key like format('result_confirm_request:%s:%s:%%', v_row.id, v_row.revision)
        and (
          (v_row.submitted_by = any(v_row.side_a_user_ids))
            <> (n.user_id = any(v_row.side_a_user_ids))
        )
    )
    into v_reached;

    if v_reached then
      update public.match_results
      set status = 'confirmed', confirmed_at = now(), updated_at = now()
      where id = v_row.id;

      perform public.apply_rating_for_result(v_row.id);

      perform public.notify_match_participants(
        v_row.match_id,
        'result_auto_confirmed',
        null,
        format('%s:%s', v_row.id, v_row.revision)
      );

      v_confirmed := v_confirmed + 1;
    else
      update public.match_results
      set status = 'unverified', updated_at = now()
      where id = v_row.id;

      v_unverified := v_unverified + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'results_auto_confirmed', v_confirmed,
    'results_unverified', v_unverified
  );
end;
$$;

revoke all on function public.resolve_stale_results() from public, anon, authenticated;
grant execute on function public.resolve_stale_results() to service_role;

-- ---------------------------------------------------------------------------
-- 9. Run both sweeps on the existing hourly schedule
-- ---------------------------------------------------------------------------
--
-- No new pg_cron entry: tennis_run_notification_jobs already runs hourly, and
-- both windows here are measured in days.

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
  v_played_prompts integer;
  v_attendance_completions integer;
  v_stale_results jsonb;
begin
  v_stale_reminders := public.schedule_stale_match_reminders();
  v_booking_reminders := public.booking_stale_reminders();
  v_court_first_reminders := public.court_first_roster_reminders();

  -- Asked before the sweep, so a match gets its question in the window rather
  -- than being expired in the same run that would have raised it.
  v_played_prompts := public.match_played_prompts();
  v_expired_matches := public.expire_stale_matches();

  v_attendance_completions := public.complete_matches_from_attendance();
  v_stale_results := public.resolve_stale_results();

  return jsonb_build_object(
    'stale_reminders_enqueued', v_stale_reminders,
    'matches_expired', v_expired_matches,
    'booking_reminders', v_booking_reminders,
    'court_first_reminders_enqueued', v_court_first_reminders,
    'played_prompts_enqueued', v_played_prompts,
    'matches_completed_by_attendance', v_attendance_completions,
    'stale_results', v_stale_results
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Completed history reads from sides
-- ---------------------------------------------------------------------------
--
-- viewer_won compared against winner_user_id, which names one person. In
-- doubles that made the winner's partner a loser in their own history.
--
-- Dropped rather than replaced: the returned row gains viewer_side and the
-- submitter's name, and create-or-replace cannot change an OUT-parameter shape.

drop function if exists public.list_my_completed_matches();

create or replace function public.list_my_completed_matches()
returns table (
  match_id uuid,
  format public.match_format,
  result_status public.result_status,
  score jsonb,
  winner_user_id uuid,
  viewer_won boolean,
  viewer_side smallint,
  submitted_by uuid,
  submitted_by_name text,
  opponent_names text,
  played_at timestamptz,
  club_name text,
  completed_at timestamptz
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
    mr.status,
    mr.score,
    mr.winner_user_id,
    case
      when mr.id is null then null
      else (
        case when v_user_id = any(mr.side_a_user_ids) then 1 else 2 end
      ) = mr.winning_side
    end,
    case
      when mr.id is null then null
      else (case when v_user_id = any(mr.side_a_user_ids) then 1::smallint else 2::smallint end)
    end,
    mr.submitted_by,
    submitter.display_name,
    (
      select string_agg(p.display_name, ', ' order by p.display_name)
      from public.match_participants as mp_other
      join public.profiles as p on p.id = mp_other.user_id
      where mp_other.match_id = m.id
        and mp_other.status = 'accepted'
        and mp_other.user_id <> v_user_id
    ),
    b.starts_at,
    c.name,
    coalesce(mr.confirmed_at, mr.resolved_at, m.updated_at)
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  -- A completed match with no score at all is now the ordinary casual case, so
  -- this can no longer be an inner join on the result.
  left join public.match_results as mr on mr.match_id = m.id
  left join public.profiles as submitter on submitter.id = mr.submitted_by
  left join lateral (
    select b_inner.starts_at, b_inner.court_id
    from public.bookings as b_inner
    where b_inner.match_id = m.id
      and b_inner.status = 'accepted'
    order by b_inner.created_at desc
    limit 1
  ) as b on true
  left join public.courts as ct on ct.id = b.court_id
  left join public.clubs as c on c.id = ct.club_id
  where mp.user_id = v_user_id
    and mp.status = 'accepted'
    and m.status = 'completed'
  order by coalesce(mr.confirmed_at, mr.resolved_at, m.updated_at) desc;
end;
$$;

revoke all on function public.list_my_completed_matches() from public, anon;
grant execute on function public.list_my_completed_matches() to authenticated;

-- ---------------------------------------------------------------------------
-- 10b. Somebody else's recent matches
-- ---------------------------------------------------------------------------
--
-- Same winner_user_id comparison, same doubles bug: the winner's partner read
-- as a loser on their own public profile. It also needs the viewed player's
-- side so the score renders from their point of view rather than side A's.
--
-- Narrowed to confirmed results as well. Showing an unconfirmed score inside
-- the match is right -- both players can see it and correct it, which is what
-- the attribution is for -- but a stranger's profile is a different surface,
-- and one player's unanswered claim does not belong there as record.

drop function if exists public.list_public_player_recent_matches(uuid, integer);

create or replace function public.list_public_player_recent_matches(
  p_user_id uuid,
  p_limit integer default 5
)
returns table (
  opponent_names text,
  player_won boolean,
  player_side smallint,
  score jsonb,
  played_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_limit integer;
begin
  v_viewer_id := public.assert_discovery_caller_eligible();
  v_limit := least(greatest(coalesce(p_limit, 5), 1), 10);

  if p_user_id = v_viewer_id then
    raise exception using
      errcode = '42501',
      message = 'Cannot load own public matches via this RPC';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = p_user_id
      and p.account_status = 'active'
      and p.onboarding_completed_at is not null
      and p.is_adult_confirmed = true
      and not public.is_blocked(v_viewer_id, p.id)
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Player not found';
  end if;

  return query
  select
    (
      select string_agg(p.display_name, ', ' order by p.display_name)
      from public.match_participants as mp_other
      join public.profiles as p on p.id = mp_other.user_id
      where mp_other.match_id = m.id
        and mp_other.status = 'accepted'
        and mp_other.user_id <> p_user_id
    ),
    (case when p_user_id = any(mr.side_a_user_ids) then 1 else 2 end) = mr.winning_side,
    (case when p_user_id = any(mr.side_a_user_ids) then 1::smallint else 2::smallint end),
    mr.score,
    b.starts_at
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  join public.match_results as mr on mr.match_id = m.id
  left join lateral (
    select b_inner.starts_at
    from public.bookings as b_inner
    where b_inner.match_id = m.id
      and b_inner.status = 'accepted'
    order by b_inner.created_at desc
    limit 1
  ) as b on true
  where mp.user_id = p_user_id
    and mp.status = 'accepted'
    and m.status = 'completed'
    and mr.status = 'confirmed'
    -- The opponent_names aggregate above lists every accepted participant, so
    -- without this a player you have blocked surfaces by name inside someone
    -- else's match history. Same class as the SEC-004 fix in migration 031:
    -- a block has to apply to the whole roster, not just the profile owner.
    and not public.is_blocked_from_match(v_viewer_id, m.id)
  order by coalesce(b.starts_at, mr.confirmed_at, mr.resolved_at, m.updated_at) desc
  limit v_limit;
end;
$$;

revoke all on function public.list_public_player_recent_matches(uuid, integer)
  from public, anon;
grant execute on function public.list_public_player_recent_matches(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Hub actions
-- ---------------------------------------------------------------------------
--
-- Redefined from 057, which is the live version -- editing the 023 copy would
-- silently drop agreed_starts_at/agreed_ends_at.
--
-- The change is that attendance and score actions no longer belong to
-- in_progress alone. Matches now complete before a score exists, so a completed
-- match still has to be able to ask for attendance, offer the optional score,
-- and route a confirmation.

create or replace function public.get_match_hub(p_match_id uuid)
returns public.match_hub_card
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_card public.match_hub_card;
  v_participant_status public.participant_status;
  v_is_creator boolean;
  v_has_pending_requests boolean;
  v_booking jsonb;
  v_result jsonb;
  v_viewer_attendance public.attendance_status;
  v_result_row public.match_results%rowtype;
  v_outcome_open boolean;
  v_viewer_side smallint;
  v_submitter_side smallint;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  select mp.status, mp.is_creator, mp.attendance
  into v_participant_status, v_is_creator, v_viewer_attendance
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id
    and mp.status in ('accepted', 'requested', 'invited');

  if v_participant_status is null
     and v_match.visibility = 'public'
     and v_match.status in ('open', 'full', 'ready_to_book') then
    null;
  elsif v_participant_status is null then
    raise exception using errcode = '42501', message = 'Not authorized to view this match';
  end if;

  select exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'requested'
  )
  into v_has_pending_requests;

  select p.display_name
  into v_card.creator_display_name
  from public.profiles as p
  where p.id = v_match.creator_id;

  select jsonb_build_object(
    'booking_id', b.id,
    'status', b.status,
    'court_id', b.court_id,
    'court_name', ct.name,
    'club_id', c.id,
    'club_name', c.name,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'price_minor', b.price_minor,
    'currency', b.currency,
    'payment_method', b.payment_method,
    'club_note', b.club_note,
    'proposed_court_id', b.proposed_court_id,
    'proposed_court_name', pct.name,
    'proposed_start_at', b.proposed_start_at,
    'proposed_end_at', b.proposed_end_at
  )
  into v_booking
  from public.bookings as b
  join public.courts as ct on ct.id = b.court_id
  join public.clubs as c on c.id = ct.club_id
  left join public.courts as pct on pct.id = b.proposed_court_id
  where b.match_id = p_match_id
    and b.status in ('requested', 'alternative_proposed', 'accepted')
  order by b.created_at desc
  limit 1;

  select *
  into v_result_row
  from public.match_results as mr
  where mr.match_id = p_match_id;

  if found then
    v_viewer_side := case
      when v_user_id = any(v_result_row.side_a_user_ids) then 1 else 2
    end;
    v_submitter_side := case
      when v_result_row.submitted_by = any(v_result_row.side_a_user_ids) then 1 else 2
    end;

    v_result := jsonb_build_object(
      'result_id', v_result_row.id,
      'status', v_result_row.status,
      'submitted_by', v_result_row.submitted_by,
      'submitted_by_name', (
        select p.display_name
        from public.profiles as p
        where p.id = v_result_row.submitted_by
      ),
      'score', v_result_row.score,
      'side_a_user_ids', to_jsonb(v_result_row.side_a_user_ids),
      'winning_side', v_result_row.winning_side,
      'winner_user_id', v_result_row.winner_user_id,
      'viewer_side', v_viewer_side,
      'viewer_won', v_viewer_side = v_result_row.winning_side,
      'revision', v_result_row.revision,
      'confirmed_by', v_result_row.confirmed_by,
      'disputed_by', v_result_row.disputed_by,
      'dispute_note', v_result_row.dispute_note
    );
  end if;

  v_outcome_open := public.match_result_entry_open(p_match_id);

  v_card.match_id := v_match.id;
  v_card.format := v_match.format;
  v_card.visibility := v_match.visibility;
  v_card.status := v_match.status;
  v_card.intent := v_match.intent;
  v_card.min_skill := v_match.min_skill;
  v_card.max_skill := v_match.max_skill;
  v_card.requires_creator_approval := v_match.requires_creator_approval;
  v_card.notes := v_match.notes;
  v_card.creator_id := v_match.creator_id;
  v_card.timing_mode := v_match.timing_mode;
  v_card.participant_count := public.match_participant_count(v_match.id);
  v_card.capacity := public.match_capacity_for_format(v_match.format);
  v_card.selected_time_option_id := v_match.selected_time_option_id;
  v_card.booking := v_booking;
  v_card.result := v_result;
  v_card.viewer_attendance := coalesce(v_viewer_attendance, 'unknown'::public.attendance_status);
  v_card.listing_expires_at := public.match_listing_expires_at(
    v_match.created_at,
    v_match.listing_extended_at
  );
  v_card.is_stale_warning := public.match_is_stale_warning(p_match_id);
  v_card.can_extend_listing := coalesce(v_is_creator, false)
    and v_match.status in ('open', 'full')
    and v_card.is_stale_warning;

  select mto.starts_at, mto.ends_at
  into v_card.agreed_starts_at, v_card.agreed_ends_at
  from public.match_time_options as mto
  where mto.id = v_match.selected_time_option_id;

  v_card.zones := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', z.id, 'slug', z.slug, 'name_i18n', z.name_i18n)
      ),
      '[]'::jsonb
    )
    from public.match_zones as mz
    join public.zones as z on z.id = mz.zone_id
    where mz.match_id = v_match.id
  );
  v_card.preferred_clubs := (
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
    where mpc.match_id = v_match.id
      and c.is_active = true
  );
  v_card.proposed_times := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', mto.id,
          'starts_at', mto.starts_at,
          'ends_at', mto.ends_at,
          'yes_count', (
            select count(*)::integer
            from public.match_time_votes as mtv
            join public.match_participants as mp
              on mp.user_id = mtv.user_id
             and mp.match_id = p_match_id
             and mp.status = 'accepted'
            where mtv.time_option_id = mto.id
              and mtv.vote = 'yes'
          ),
          'required_count', public.match_participant_count(p_match_id),
          'viewer_vote', (
            select mtv.vote::text
            from public.match_time_votes as mtv
            where mtv.time_option_id = mto.id
              and mtv.user_id = v_user_id
          )
        )
        order by mto.starts_at
      ),
      '[]'::jsonb
    )
    from public.match_time_options as mto
    where mto.match_id = v_match.id
      and mto.withdrawn_at is null
      and (
        mto.ends_at > now()
        or mto.id = v_match.selected_time_option_id
      )
  );
  v_card.participants := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', p.id,
          'display_name', p.display_name,
          'status', mp.status,
          'is_creator', mp.is_creator,
          'attendance', mp.attendance
        )
        order by mp.is_creator desc, p.display_name
      ),
      '[]'::jsonb
    )
    from public.match_participants as mp
    join public.profiles as p on p.id = mp.user_id
    where mp.match_id = v_match.id
      and mp.status in ('accepted', 'requested', 'invited')
  );
  v_card.pending_requests := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', p.id,
          'display_name', p.display_name,
          'status', mp.status
        )
        order by mp.joined_at nulls last
      ),
      '[]'::jsonb
    )
    from public.match_participants as mp
    join public.profiles as p on p.id = mp.user_id
    where mp.match_id = v_match.id
      and mp.status = 'requested'
      and coalesce(v_is_creator, false)
  );
  v_card.viewer_status := v_participant_status;
  v_card.viewer_is_creator := coalesce(v_is_creator, false);

  if v_is_creator and v_match.status = 'draft' then
    v_card.next_action := 'publish_match';
  elsif v_participant_status = 'accepted'
     and v_booking is not null
     and (v_booking->>'status') = 'alternative_proposed'
     and v_is_creator then
    v_card.next_action := 'review_alternative';
  elsif v_match.status = 'booking_pending' then
    v_card.next_action := 'awaiting_club';
  elsif v_match.status = 'confirmed' then
    v_card.next_action := 'pay_at_club';

  -- Attendance first, because it is what completes the match.
  elsif v_match.status in ('in_progress', 'completed')
     and v_participant_status = 'accepted'
     and coalesce(v_viewer_attendance, 'unknown') = 'unknown'
     and v_outcome_open then
    v_card.next_action := 'record_attendance';

  elsif v_match.status in ('in_progress', 'completed')
     and v_participant_status = 'accepted'
     and v_result is null
     and v_outcome_open then
    v_card.next_action := 'submit_result';

  elsif v_match.status in ('in_progress', 'completed')
     and v_participant_status = 'accepted'
     and v_result is not null
     and (v_result->>'status') = 'submitted'
     and (v_result->>'submitted_by')::uuid <> v_user_id
     and v_viewer_side <> v_submitter_side then
    v_card.next_action := 'confirm_result';

  -- The one reopen belongs to whoever objected.
  elsif v_result is not null
     and (v_result->>'status') = 'disputed'
     and (v_result->>'disputed_by')::uuid = v_user_id
     and (v_result->>'revision')::integer = 1 then
    v_card.next_action := 'resubmit_result';

  elsif v_match.status = 'completed'
     and v_result is not null
     and (v_result->>'status') = 'disputed' then
    v_card.next_action := 'result_disputed';
  elsif v_match.status = 'completed' then
    v_card.next_action := 'view_completed';
  elsif v_is_creator and v_match.status = 'ready_to_book' then
    v_card.next_action := 'request_court';
  elsif v_participant_status = 'accepted' and v_match.status = 'ready_to_book' then
    v_card.next_action := 'time_agreed';
  elsif v_is_creator and v_has_pending_requests and v_match.status in ('open', 'full') then
    v_card.next_action := 'manage_requests';
  elsif v_participant_status = 'accepted' and v_match.status in ('open', 'full') then
    v_card.next_action := case
      when v_match.timing_mode = 'fixed' then 'awaiting_players'
      else 'vote_on_times'
    end;
  elsif v_participant_status is null and v_match.status = 'open' then
    v_card.next_action := case
      when v_match.requires_creator_approval then 'request_to_join'
      else 'join_match'
    end;
  else
    v_card.next_action := 'view_match';
  end if;

  return v_card;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Grants
-- ---------------------------------------------------------------------------
--
-- submit_match_result changed signature, so its old grant went with the dropped
-- function and the new one needs issuing.

revoke all on function public.submit_match_result(uuid, jsonb, uuid[]) from public, anon;
revoke all on function public.resubmit_match_result(uuid, jsonb, uuid[]) from public, anon;
revoke all on function public.confirm_match_result(uuid) from public, anon;
revoke all on function public.dispute_match_result(uuid, text) from public, anon;
revoke all on function public.record_match_attendance(uuid, public.attendance_status) from public, anon;

grant execute on function public.submit_match_result(uuid, jsonb, uuid[]) to authenticated;
grant execute on function public.resubmit_match_result(uuid, jsonb, uuid[]) to authenticated;
grant execute on function public.confirm_match_result(uuid) to authenticated;
grant execute on function public.dispute_match_result(uuid, text) to authenticated;
grant execute on function public.record_match_attendance(uuid, public.attendance_status) to authenticated;
