-- A player could be in two matches at the same hour.
--
-- Nothing anywhere checked for a time conflict. `hosted_match_cap` counts
-- hosted matches and stops at three, and `032_discovery_overlap` is about
-- availability overlap in discovery — neither looks at whether a player has
-- already committed to that hour. So one person could hold three matches at
-- 19:00 on Thursday, and worse, could *join* several matches that overlap each
-- other. Every one of those is a no-show waiting to happen, and no-show rate is
-- the counter-metric this pilot is watching. Found in the Phase 0.3 rehearsal.
--
-- Joining is blocked; hosting is only warned about, in the client. A host
-- offering the same evening across two listings is recruiting, not
-- double-booking — they will play at most one of them, and which one is not
-- decided yet. A joiner accepting an hour they have already committed to is
-- making a promise they cannot keep, and that is worth a hard stop.
--
-- Only **agreed** times count. `create_and_publish_match` sets
-- `selected_time_option_id` for a fixed match at publish, so the default create
-- path is covered from the moment it goes live; a flexible match gets one when
-- a slot goes unanimous. Proposed slots are candidates, and blocking on those
-- would stop a host offering the same three evenings on two listings.
--
-- "In" means an `accepted` participation in a live match. A `requested` row is
-- not a commitment — the host may still decline it — so it neither blocks nor
-- is blocked. Overlap is half-open (`[)`), so a match ending at 20:00 and one
-- starting at 20:00 do not collide.

-- Match statuses that represent a commitment to an hour. Deliberately excludes
-- `draft` (not published), `completed`, `cancelled` and `expired` (over).
create or replace function public.live_commitment_statuses()
returns public.match_status[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'open',
    'full',
    'ready_to_book',
    'booking_pending',
    'confirmed',
    'in_progress'
  ]::public.match_status[];
$$;

create or replace function public.match_agreed_starts_at(p_match_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select mto.starts_at
  from public.matches as m
  join public.match_time_options as mto on mto.id = m.selected_time_option_id
  where m.id = p_match_id
    and mto.withdrawn_at is null;
$$;

create or replace function public.match_agreed_ends_at(p_match_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select mto.ends_at
  from public.matches as m
  join public.match_time_options as mto on mto.id = m.selected_time_option_id
  where m.id = p_match_id
    and mto.withdrawn_at is null;
$$;

-- Shared by the join guard and the client-facing warning below, so the rule
-- cannot drift between the thing that blocks and the thing that explains.
-- Returns nothing when the window is unknown: a match with no agreed time
-- cannot conflict with anything yet.
create or replace function public.viewer_agreed_time_conflicts_for(
  p_user_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_match_id uuid default null
)
returns table (
  match_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, mto.starts_at, mto.ends_at
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  join public.match_time_options as mto on mto.id = m.selected_time_option_id
  where mp.user_id = p_user_id
    and mp.status = 'accepted'
    and mto.withdrawn_at is null
    and m.status = any(public.live_commitment_statuses())
    and (p_exclude_match_id is null or m.id <> p_exclude_match_id)
    and p_starts_at is not null
    and p_ends_at is not null
    and tstzrange(mto.starts_at, mto.ends_at, '[)')
        && tstzrange(p_starts_at, p_ends_at, '[)')
  order by mto.starts_at;
$$;

revoke all on function public.viewer_agreed_time_conflicts_for(uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;

-- The caller-facing wrapper. Used by the create review step to warn a host
-- before they publish, and by the join path to explain the block before the
-- RPC raises it.
create or replace function public.viewer_agreed_time_conflicts(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_match_id uuid default null
)
returns table (
  match_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
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

  return query
  select *
  from public.viewer_agreed_time_conflicts_for(
    v_user_id,
    p_starts_at,
    p_ends_at,
    p_exclude_match_id
  );
end;
$$;

revoke all on function public.viewer_agreed_time_conflicts(timestamptz, timestamptz, uuid)
  from public, anon;
grant execute on function public.viewer_agreed_time_conflicts(timestamptz, timestamptz, uuid)
  to authenticated;

create or replace function public.join_match(
  p_match_id uuid,
  p_note text default null
)
returns public.participant_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
  v_status public.participant_status;
  v_note text;
begin
  v_user_id := public.assert_marketplace_caller();
  v_match := public.assert_joinable_match(p_match_id, v_user_id, false);

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'already_participant';
  end if;

  -- A player cannot be in two places at once. Checked against *agreed* times
  -- only: a fixed match carries `selected_time_option_id` from publish, and a
  -- flexible one gets it when a slot goes unanimous, so proposed slots stay
  -- free to overlap while a host is still recruiting.
  if exists (
    select 1
    from public.viewer_agreed_time_conflicts_for(
      v_user_id,
      public.match_agreed_starts_at(p_match_id),
      public.match_agreed_ends_at(p_match_id),
      p_match_id
    )
  ) then
    raise exception using errcode = 'P0001', message = 'match_time_conflict';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_match_id);

  if v_match.requires_creator_approval then
    v_status := 'requested';
    v_note := public.sanitize_player_note(p_note);
  else
    if v_count >= v_capacity then
      raise exception using errcode = 'P0001', message = 'match_full';
    end if;
    v_status := 'accepted';
    -- Instant join has no host decision surface; ignore any smuggled note.
    v_note := null;
  end if;

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status in ('left', 'declined', 'removed')
  ) then
    update public.match_participants
    set
      status = v_status,
      joined_at = case when v_status = 'accepted' then now() else null end,
      left_at = null,
      join_note = v_note
    where match_id = p_match_id
      and user_id = v_user_id;
  else
    insert into public.match_participants (
      match_id,
      user_id,
      status,
      is_creator,
      joined_at,
      join_note
    )
    values (
      p_match_id,
      v_user_id,
      v_status,
      false,
      case when v_status = 'accepted' then now() else null end,
      v_note
    );
  end if;

  if v_status = 'accepted' then
    perform public.refresh_match_open_state(p_match_id);
  end if;

  return v_status;
end;
$$;
