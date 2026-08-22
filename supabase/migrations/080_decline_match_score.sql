-- Saying "we did not keep score" is an act, not the absence of one.
--
-- `064` made the score optional: attendance completes a match, and a scoreless
-- match is a complete, attributed, unrated result. What it did not give players
-- was a way to *say* that. `can_submit_result` gates on `not hasResult`, which
-- never becomes false if nobody submits, so the score form renders forever on
-- exactly the matches the pilot expects to be most common -- two people who hit
-- for an hour and never wrote the games down. The one path most players take is
-- the only one that never resolves.
--
-- Recorded per participant rather than once per match, mirroring
-- `match_participants.attendance` rather than `match_results`. A score is a
-- shared fact and one player may well remember it: if Yara declines and Jihad
-- then submits 6-4 4-6 6-3, that has to keep working, and Yara should get the
-- ordinary confirmation request. A single match-level flag would let whoever
-- opened the app first close scoring for both and would need an undo path to
-- climb back out.
--
-- Reversible on purpose. `p_declined => false` clears it, so a player who
-- declines and then remembers the score is not stuck.

alter table public.match_participants
  add column if not exists score_declined_at timestamptz;

comment on column public.match_participants.score_declined_at is
  'When this participant said the match had no score to record. Null means they have not said either way.';

create or replace function public.decline_match_score(
  p_match_id uuid,
  p_declined boolean default true
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_attendance public.attendance_status;
  v_next timestamptz;
begin
  v_user_id := public.assert_marketplace_caller();

  select * into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  -- Same window the score form itself uses.
  if v_match.status not in ('in_progress', 'completed') then
    raise exception using errcode = 'P0001', message = 'result_match_not_playable';
  end if;

  select mp.attendance into v_attendance
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id
    and mp.status = 'accepted';

  if not found then
    raise exception using errcode = '42501', message = 'not_a_match_participant';
  end if;

  -- Mirrors `submit_match_result`: someone who did not turn up has no score to
  -- decline, but an unanswered attendance is not a bar.
  if v_attendance in ('no_show', 'late_cancel', 'cancelled_in_time') then
    raise exception using errcode = 'P0001', message = 'result_submitter_did_not_play';
  end if;

  -- Once a score exists there is nothing to decline; confirm or dispute it.
  if exists (
    select 1 from public.match_results as mr where mr.match_id = p_match_id
  ) then
    raise exception using errcode = 'P0001', message = 'result_already_exists';
  end if;

  v_next := case when p_declined then now() else null end;

  update public.match_participants
  set score_declined_at = v_next
  where match_id = p_match_id
    and user_id = v_user_id;

  return v_next;
end;
$$;

revoke all on function public.decline_match_score(uuid, boolean) from public, anon;
grant execute on function public.decline_match_score(uuid, boolean) to authenticated;

-- Read-back for the viewer's own row. Deliberately its own function rather than
-- a new field on `get_match_hub`: that is a 331-line function returning a shared
-- composite, and redefining it wholesale to carry one nullable timestamp is far
-- more blast radius than this is worth.
create or replace function public.get_own_score_declined(p_match_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select mp.score_declined_at
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = public.assert_marketplace_caller()
    and mp.status = 'accepted';
$$;

revoke all on function public.get_own_score_declined(uuid) from public, anon;
grant execute on function public.get_own_score_declined(uuid) to authenticated;
