-- Facts the rematch card needs: how much tennis these two have played together,
-- who is ahead, and how many matches the caller has played overall.
--
-- One function rather than two because both answers are the same question asked
-- at different scopes, and the card renders them in one sentence: "That's 8
-- matches. Your 3rd with Player B -- you lead 2-1."
--
-- Win counts use `status = 'confirmed'` only. That is the sole status
-- representing a result that actually stood: an operator void writes 'resolved'
-- (026), 'unverified' means the confirmation request never reached the other
-- side (M9.3), and 'submitted'/'disputed' are unsettled. A head-to-head record
-- is a claim about someone else, so it may only be built from results that
-- moved a rating. `played_together` counts every completed match regardless,
-- because attendance completes a match and a scoreless casual hit still
-- happened.
--
-- Not a privacy surface: for a stranger every count is zero, which reveals only
-- that the two have never played. The opponent's identity is already known to
-- the caller -- they are on a match hub together.

create or replace function public.get_rematch_context(p_opponent_id uuid)
returns table (
  played_together integer,
  viewer_wins integer,
  opponent_wins integer,
  viewer_total_completed integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  if p_opponent_id is null or p_opponent_id = v_user_id then
    raise exception using errcode = 'P0001',
      message = 'An opponent other than the caller is required';
  end if;

  return query
  with shared as (
    select m.id as match_id
    from public.matches as m
    join public.match_participants as mine
      on mine.match_id = m.id
     and mine.user_id = v_user_id
     and mine.status = 'accepted'
    join public.match_participants as theirs
      on theirs.match_id = m.id
     and theirs.user_id = p_opponent_id
     and theirs.status = 'accepted'
    where m.status = 'completed'
  ),
  decided as (
    -- Mirrors list_my_completed_matches (064): side A is whichever side holds
    -- the viewer, and the winner is derived rather than trusted from a column.
    select
      (
        (case when v_user_id = any(mr.side_a_user_ids) then 1 else 2 end)
        = mr.winning_side
      ) as viewer_won
    from shared as s
    join public.match_results as mr on mr.match_id = s.match_id
    where mr.status = 'confirmed'
      and mr.winning_side is not null
  )
  select
    (select count(*)::integer from shared),
    (select count(*)::integer from decided where decided.viewer_won),
    (select count(*)::integer from decided where not decided.viewer_won),
    (
      select count(*)::integer
      from public.matches as m2
      join public.match_participants as mp2
        on mp2.match_id = m2.id
       and mp2.user_id = v_user_id
       and mp2.status = 'accepted'
      where m2.status = 'completed'
    );
end;
$$;

revoke all on function public.get_rematch_context(uuid) from public, anon;
grant execute on function public.get_rematch_context(uuid) to authenticated;
