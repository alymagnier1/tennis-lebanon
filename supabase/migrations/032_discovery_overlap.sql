-- Milestone 8.9: make availability legible in discovery.
--
-- Audit finding: discovery is not weak, it is starved. Availability overlap is
-- already the primary sort key and a default filter requiring a full hour of
-- shared time, but the profile screen captures one window at a time behind
-- free-text time fields, so most players supply one or two windows and the
-- intersection is empty. Two changes follow:
--
--   1. set_recurring_availability lets the client save a whole weekly grid in
--      one atomic call, mirroring set_court_weekly_hours.
--   2. discover_compatible_players now returns the concrete shared interval so
--      the UI can say "Both free Tue 18:00-20:00" instead of a yes/no hint.

-- ---------------------------------------------------------------------------
-- Bulk weekly availability
-- ---------------------------------------------------------------------------

create or replace function public.set_recurring_availability(p_windows jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_window jsonb;
  v_weekday integer;
  v_start time;
  v_end time;
  v_count integer := 0;
begin
  v_user_id := public.assert_marketplace_caller();

  if jsonb_typeof(coalesce(p_windows, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Availability must be an array';
  end if;

  if jsonb_array_length(coalesce(p_windows, '[]'::jsonb)) > 60 then
    raise exception using errcode = 'P0001', message = 'Too many availability windows';
  end if;

  -- Replace the recurring set wholesale; one-off windows are left untouched.
  delete from public.availability_windows as aw
  where aw.user_id = v_user_id
    and aw.is_recurring = true;

  for v_window in
    select value
    from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb))
  loop
    v_weekday := (v_window->>'weekday')::integer;
    v_start := (v_window->>'local_start')::time;
    v_end := (v_window->>'local_end')::time;

    if v_weekday is null or v_weekday < 0 or v_weekday > 6 then
      raise exception using errcode = '22023', message = 'Weekday must be 0-6';
    end if;

    if v_start is null or v_end is null or v_end <= v_start then
      raise exception using errcode = '22023', message = 'End time must be after start time';
    end if;

    insert into public.availability_windows (
      user_id,
      weekday,
      local_start,
      local_end,
      timezone,
      is_recurring
    )
    values (
      v_user_id,
      v_weekday,
      v_start,
      v_end,
      'Asia/Beirut',
      true
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.set_recurring_availability(jsonb) from public, anon;
grant execute on function public.set_recurring_availability(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Concrete shared interval
-- ---------------------------------------------------------------------------

create or replace function public.first_availability_overlap(
  p_user_a uuid,
  p_user_b uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    greatest(a.starts_at, b.starts_at),
    least(a.ends_at, b.ends_at)
  from public.expand_user_availability(p_user_a, p_range_start, p_range_end) as a
  cross join public.expand_user_availability(p_user_b, p_range_start, p_range_end) as b
  where greatest(a.starts_at, b.starts_at) < least(a.ends_at, b.ends_at)
    and extract(
      epoch from (
        least(a.ends_at, b.ends_at) - greatest(a.starts_at, b.starts_at)
      )
    ) >= 3600
  order by greatest(a.starts_at, b.starts_at)
  limit 1;
$$;

revoke all on function public.first_availability_overlap(uuid, uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.first_availability_overlap(uuid, uuid, timestamptz, timestamptz)
  to authenticated;

alter type public.discover_compatible_player_card
  add attribute overlap_starts_at timestamptz;
alter type public.discover_compatible_player_card
  add attribute overlap_ends_at timestamptz;

create or replace function public.discover_compatible_players(
  p_zone_ids uuid[] default null,
  p_format public.match_format default null,
  p_intent public.play_intent default null,
  p_require_availability_overlap boolean default false,
  p_horizon_days integer default 14,
  p_level_window integer default 1,
  p_limit integer default 20,
  p_cursor_user_id uuid default null
)
returns setof public.discover_compatible_player_card
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_viewer_band public.skill_band;
  v_viewer_intent public.play_intent;
  v_viewer_singles boolean;
  v_viewer_doubles boolean;
  v_zone_ids uuid[];
  v_range_start timestamptz := now();
  v_range_end timestamptz;
  v_limit integer;
  v_level_window integer;
begin
  v_viewer_id := public.assert_discovery_caller_eligible();
  perform public.enforce_discovery_rate_limit(v_viewer_id, 'compatible_players');

  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_level_window := greatest(coalesce(p_level_window, 1), 0);
  v_range_end := v_range_start + make_interval(
    days => least(greatest(coalesce(p_horizon_days, 14), 1), 28)
  );

  select pp.skill_band, pp.play_intent, pp.prefers_singles, pp.prefers_doubles
  into v_viewer_band, v_viewer_intent, v_viewer_singles, v_viewer_doubles
  from public.player_profiles as pp
  where pp.user_id = v_viewer_id;

  if p_zone_ids is null or cardinality(p_zone_ids) = 0 then
    select coalesce(array_agg(pz.zone_id order by pz.priority), '{}'::uuid[])
    into v_zone_ids
    from public.player_zones as pz
    where pz.user_id = v_viewer_id;
  else
    v_zone_ids := p_zone_ids;
  end if;

  return query
  with candidates as (
    select
      p.id as user_id,
      p.display_name,
      p.avatar_path,
      pp.skill_band,
      pp.play_intent,
      pp.prefers_singles,
      pp.prefers_doubles,
      pp.rated_match_count,
      pp.internal_rating,
      abs(
        public.skill_band_rank(pp.skill_band)
        - public.skill_band_rank(v_viewer_band)
      ) as level_distance,
      exists (
        select 1
        from public.player_zones as pz
        where pz.user_id = p.id
          and pz.zone_id = any(v_zone_ids)
      ) as zone_overlap,
      public.has_availability_overlap(
        v_viewer_id,
        p.id,
        v_range_start,
        v_range_end
      ) as availability_overlap,
      (pp.play_intent = v_viewer_intent or pp.play_intent = 'either' or v_viewer_intent = 'either') as intent_fit,
      (
        (p_format is null)
        or (p_format = 'singles' and pp.prefers_singles)
        or (p_format = 'doubles' and pp.prefers_doubles)
      ) as format_fit
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
      and abs(
        public.skill_band_rank(pp.skill_band)
        - public.skill_band_rank(v_viewer_band)
      ) <= v_level_window
      and (p_intent is null or pp.play_intent = p_intent or pp.play_intent = 'either')
      and (
        p_format is null
        or (p_format = 'singles' and pp.prefers_singles)
        or (p_format = 'doubles' and pp.prefers_doubles)
      )
      and (
        p_require_availability_overlap is distinct from true
        or public.has_availability_overlap(
          v_viewer_id,
          p.id,
          v_range_start,
          v_range_end
        )
      )
      and (p_cursor_user_id is null or p.id > p_cursor_user_id)
  )
  select
    c.user_id,
    c.display_name,
    c.avatar_path,
    c.skill_band,
    c.play_intent,
    c.prefers_singles,
    c.prefers_doubles,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', z.id,
            'slug', z.slug,
            'name_i18n', z.name_i18n
          )
          order by pz.priority
        ),
        '[]'::jsonb
      )
      from public.player_zones as pz
      join public.zones as z on z.id = pz.zone_id
      where pz.user_id = c.user_id
        and z.is_active = true
    ) as zones,
    case
      when c.rated_match_count < 5 then 'provisional'
      else 'established'
    end as provisional_rating_label,
    public.completed_match_count_for_user(c.user_id) as completed_match_count,
    c.level_distance <= v_level_window as level_fit,
    c.zone_overlap,
    c.availability_overlap,
    c.intent_fit,
    c.format_fit,
    case
      when c.rated_match_count >= 5 then c.internal_rating
      else null
    end as display_rating,
    ov.starts_at as overlap_starts_at,
    ov.ends_at as overlap_ends_at
  from candidates as c
  left join lateral public.first_availability_overlap(
    v_viewer_id,
    c.user_id,
    v_range_start,
    v_range_end
  ) as ov on true
  order by
    c.availability_overlap desc,
    c.level_distance asc,
    public.completed_match_count_for_user(c.user_id) desc,
    c.user_id asc
  limit v_limit;
end;
$$;

revoke all on function public.discover_compatible_players(
  uuid[], public.match_format, public.play_intent, boolean, integer, integer, integer, uuid
) from public, anon;
grant execute on function public.discover_compatible_players(
  uuid[], public.match_format, public.play_intent, boolean, integer, integer, integer, uuid
) to authenticated;
