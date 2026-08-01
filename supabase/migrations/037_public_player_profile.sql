-- Public player profile: coarse recurring availability + recent completed matches.

create or replace function public.availability_day_part_from_local(p_local_start time)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(hour from p_local_start) >= 7
     and extract(hour from p_local_start) < 12 then 'morning'
    when extract(hour from p_local_start) >= 12
     and extract(hour from p_local_start) < 17 then 'afternoon'
    when extract(hour from p_local_start) >= 17
     and extract(hour from p_local_start) < 22 then 'evening'
    when extract(hour from p_local_start) < 7 then 'morning'
    else 'evening'
  end;
$$;

create or replace function public.get_public_player_availability_summary(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
begin
  v_viewer_id := public.assert_discovery_caller_eligible();

  if p_user_id = v_viewer_id then
    raise exception using
      errcode = '42501',
      message = 'Cannot load own public availability via this RPC';
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

  return jsonb_build_object(
    'weekdays',
    coalesce(
      (
        select jsonb_agg(distinct aw.weekday order by aw.weekday)
        from public.availability_windows as aw
        where aw.user_id = p_user_id
          and aw.is_recurring = true
      ),
      '[]'::jsonb
    ),
    'day_parts',
    coalesce(
      (
        select jsonb_agg(distinct part order by part)
        from (
          select public.availability_day_part_from_local(aw.local_start) as part
          from public.availability_windows as aw
          where aw.user_id = p_user_id
            and aw.is_recurring = true
        ) as parts
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_public_player_availability_summary(uuid)
  from public, anon;
grant execute on function public.get_public_player_availability_summary(uuid)
  to authenticated;

create or replace function public.list_public_player_recent_matches(
  p_user_id uuid,
  p_limit integer default 5
)
returns table (
  opponent_names text,
  player_won boolean,
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
    mr.winner_user_id = p_user_id,
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
