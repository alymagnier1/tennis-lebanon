-- The other half of the "I'm free" ping (073): reading the pings back out.
--
-- A ping writes intent. On its own that is a diary entry -- the player declares a
-- free Thursday and nothing happens, because nobody is told. This answers the
-- question the ping cannot: "is anyone else free then?" Together they form the
-- loop -- declare, see the demand, meet in the same block.
--
-- Aggregated in SQL rather than counted on the client, for three reasons:
--
--   1. `discover_compatible_players` is paginated by `p_limit` (default 20, max
--      50) with a cursor. Counting its rows would silently undercount the moment
--      a block has more free players than one page holds, and a demand signal
--      that reads "20 players" when the real number is 34 is worse than none.
--   2. `near_term_overlap_slots` -- the only per-player overlap the client
--      already receives -- covers today plus two days (040). A week does not fit.
--   3. This needs counts, not people. Pulling full player cards (names, avatars,
--      ratings, zones, favourite clubs) to reduce them to an integer ships
--      personal data for a feature that never displays any.
--
-- Eligibility mirrors `discover_compatible_players` exactly on the rules a player
-- cannot change -- active, onboarded, adult, not blocked, in zone. It deliberately
-- does NOT apply the level, format or intent filters: those are the viewer's own
-- adjustable preferences, and Discover's default view does not restrict on them
-- either. The count has to be a promise the Discover screen can keep.
--
-- No `enforce_discovery_rate_limit` here, unlike discovery. That budget is 30
-- calls a minute shared across every surface, and it is spent by user-initiated
-- searches; charging a passive Home read to the same account would let opening
-- Home a few times make Discover raise `discovery_rate_limited`. The function
-- returns nothing but aggregate counts, so hammering it reveals no more than one
-- call does, and the horizon clamp bounds the work.

create or replace function public.get_availability_liquidity(
  p_horizon_days integer default 7,
  p_zone_ids uuid[] default null
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  player_count integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_zone_ids uuid[];
  v_horizon integer;
  v_today date;
  v_range_end timestamptz;
begin
  v_viewer_id := public.assert_marketplace_caller();

  v_horizon := least(greatest(coalesce(p_horizon_days, 7), 1), 14);

  -- Same fallback as discovery: no explicit zones means the viewer's own. When
  -- they have none the result is unrestricted, which is also what Discover shows
  -- them, so the two surfaces agree. The copy must not claim proximity.
  if p_zone_ids is null or cardinality(p_zone_ids) = 0 then
    select coalesce(array_agg(pz.zone_id), '{}'::uuid[])
    into v_zone_ids
    from public.player_zones as pz
    where pz.user_id = v_viewer_id;
  else
    v_zone_ids := p_zone_ids;
  end if;

  v_today := (now() at time zone 'Asia/Beirut')::date;
  v_range_end := ((v_today + v_horizon)::timestamp at time zone 'Asia/Beirut');

  return query
  with blocks as (
    -- Matches TIME_BLOCKS in app/profile/availability.tsx and PING_BLOCKS in
    -- src/lib/availability-ping.ts. The client labels a returned range with
    -- `availabilityDayPartsFromOverlap`, so if these edges ever drift the label
    -- still describes the range honestly -- it just describes a range nobody
    -- chose. Keep them in step.
    select *
    from (values
      (time '07:00', time '12:00'),
      (time '12:00', time '17:00'),
      (time '17:00', time '22:00')
    ) as b(local_start, local_end)
  ),
  buckets as (
    select
      (((v_today + d.offs) + b.local_start) at time zone 'Asia/Beirut')
        as bucket_start,
      (((v_today + d.offs) + b.local_end) at time zone 'Asia/Beirut')
        as bucket_end
    from generate_series(0, v_horizon - 1) as d(offs)
    cross join blocks as b
  ),
  upcoming as (
    -- A block that has ended is not an offer. `usable_from` also trims the block
    -- in progress to the part still ahead: at 21:30 the evening has half an hour
    -- left, which is not a match, and claiming "4 players free this evening"
    -- would be a lie the player discovers by tapping.
    select
      b.bucket_start,
      b.bucket_end,
      greatest(b.bucket_start, now()) as usable_from
    from buckets as b
    where b.bucket_end > now()
  ),
  candidates as (
    select p.id as user_id
    from public.profiles as p
    join public.player_profiles as pp on pp.user_id = p.id
    where p.id <> v_viewer_id
      and p.account_status = 'active'
      and p.onboarding_completed_at is not null
      and p.is_adult_confirmed = true
      and not public.is_blocked(v_viewer_id, p.id)
      and (
        cardinality(v_zone_ids) = 0
        or exists (
          select 1
          from public.player_zones as pz
          where pz.user_id = p.id
            and pz.zone_id = any(v_zone_ids)
        )
      )
  ),
  candidate_slots as (
    -- Expanded once per candidate over the whole horizon, then intersected with
    -- each block below. Expanding per candidate per block instead would call this
    -- plpgsql loop 21 times per player for the same answer.
    --
    -- Aliased away from starts_at/ends_at on purpose: those are this function's
    -- OUT parameter names, and an unqualified reference inside `return query`
    -- would be ambiguous.
    select
      c.user_id,
      slot.starts_at as slot_start,
      slot.ends_at as slot_end
    from candidates as c
    cross join lateral public.expand_user_availability(
      c.user_id,
      now(),
      v_range_end
    ) as slot
  )
  select
    u.bucket_start,
    u.bucket_end,
    -- Distinct because one player can hold both a recurring and a one-off window
    -- over the same block; that is one player free, not two.
    count(distinct cs.user_id)::integer
  from upcoming as u
  join candidate_slots as cs
    on cs.slot_start < u.bucket_end
   and cs.slot_end > u.usable_from
  -- One contiguous hour inside the block, matching the floor discovery already
  -- uses for a shared slot (040). A twenty-minute sliver is not a game.
  where extract(epoch from (
          least(cs.slot_end, u.bucket_end)
          - greatest(cs.slot_start, u.usable_from)
        )) >= 3600
  group by u.bucket_start, u.bucket_end
  order by u.bucket_start;
end;
$$;

revoke all on function public.get_availability_liquidity(integer, uuid[]) from public, anon;
grant execute on function public.get_availability_liquidity(integer, uuid[]) to authenticated;

/*
 * Adds `liquidity_signal_viewed` to the client-event allowlist, and `player_count`
 * to the prop keys.
 *
 * `availability_ping_sent` needs no change: it already carries `day_part` and
 * `day_offset`, and `surface` is already allowlisted from the rematch events --
 * which is the point of that prop. A ping from a liquidity row and a ping from a
 * chip are the same act with different motivation, and only `surface` can tell
 * which one converts.
 *
 * Extending the allowlist requires a migration by design: that is what forces the
 * privacy question to be asked for each new event. Both new values are integers.
 */
create or replace function public.record_client_event(
  p_event text,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_props jsonb;
  v_key text;
  v_value jsonb;
  v_recent integer;
begin
  -- Deliberately not assert_marketplace_caller(): that requires a completed
  -- onboarding (via assert_discovery_caller_eligible), and onboarding drop-off is
  -- the first thing this table exists to measure.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_event is null or p_event <> all (array[
    'onboarding_step_viewed',
    'push_permission_prompted',
    'discover_viewed',
    'create_step_viewed',
    'create_abandoned',
    'rematch_offered',
    'rematch_started',
    'rematch_published',
    'availability_ping_sent',
    'liquidity_signal_viewed'
  ]) then
    raise exception using errcode = 'P0001', message = 'Unknown client event';
  end if;

  v_props := coalesce(p_props, '{}'::jsonb);

  if jsonb_typeof(v_props) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Event props must be an object';
  end if;

  for v_key, v_value in select * from jsonb_each(v_props)
  loop
    if v_key <> all (array[
      'step',
      'step_index',
      'surface',
      'segment',
      'filters_active',
      'result_count',
      'is_empty',
      'granted',
      'can_ask_again',
      'opponent_count',
      'hours_since_prior',
      'day_part',
      'day_offset',
      'player_count'
    ]) then
      raise exception using errcode = 'P0001',
        message = format('Prop %s is not on the allowlist', v_key);
    end if;

    if jsonb_typeof(v_value) not in ('string', 'number', 'boolean') then
      raise exception using errcode = 'P0001',
        message = format('Prop %s must be a scalar', v_key);
    end if;

    -- Short snake_case tokens only, and they must start with a letter. That
    -- leaves room for 'hub' or 'players' while rejecting an email, a display
    -- name, or a phone number smuggled into a string prop.
    if jsonb_typeof(v_value) = 'string'
       and (v_value #>> '{}') !~ '^[a-z][a-z0-9_]{0,31}$' then
      raise exception using errcode = 'P0001',
        message = format('Prop %s must be a short snake_case token', v_key);
    end if;
  end loop;

  -- A runaway render loop must not be able to fill the table. Dropped silently
  -- rather than raised: analytics must never surface an error to a player.
  select count(*)
  into v_recent
  from public.client_events as ce
  where ce.user_id = v_user_id
    and ce.created_at > now() - interval '1 hour';

  if v_recent >= 300 then
    return;
  end if;

  insert into public.client_events (user_id, event, props)
  values (v_user_id, p_event, v_props);
end;
$$;

revoke all on function public.record_client_event(text, jsonb) from public, anon;
grant execute on function public.record_client_event(text, jsonb) to authenticated;
