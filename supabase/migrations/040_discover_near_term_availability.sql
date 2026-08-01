-- Discovery cards show today + the next two days (Asia/Beirut). The availability
-- chip filters to players with shared time in that same window.

alter type public.discover_compatible_player_card
  add attribute near_term_slots jsonb;

alter type public.discover_compatible_player_card
  add attribute near_term_overlap_slots jsonb;

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
  v_near_term_start timestamptz := now();
  v_near_term_end timestamptz := (
    (date_trunc('day', now() at time zone 'Asia/Beirut') + interval '3 days')
    at time zone 'Asia/Beirut'
  );
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
      pp.bio,
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
        p_zone_ids is null
        or cardinality(p_zone_ids) = 0
        or exists (
          select 1
          from public.player_zones as pz
          where pz.user_id = p.id
            and pz.zone_id = any(p_zone_ids)
        )
      )
      and (
        p_format is null
        or (p_format = 'singles' and pp.prefers_singles)
        or (p_format = 'doubles' and pp.prefers_doubles)
      )
      and (
        p_intent is null
        or pp.play_intent = p_intent
        or pp.play_intent = 'either'
      )
      and (
        p_require_availability_overlap is distinct from true
        -- Filter over the caller's horizon, not the near-term window. The
        -- near-term window exists only to render the compact card chips; using
        -- it here would silently reduce p_horizon_days to 3 days and hide any
        -- player whose next shared slot is further out.
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
    ov.ends_at as overlap_ends_at,
    c.bio,
    coalesce(
      (
        select jsonb_agg(distinct aw.weekday order by aw.weekday)
        from public.availability_windows as aw
        where aw.user_id = c.user_id
          and aw.is_recurring = true
      ),
      '[]'::jsonb
    ) as availability_weekdays,
    coalesce(
      (
        select jsonb_agg(distinct part order by part)
        from (
          select public.availability_day_part_from_local(aw.local_start) as part
          from public.availability_windows as aw
          where aw.user_id = c.user_id
            and aw.is_recurring = true
        ) as parts
      ),
      '[]'::jsonb
    ) as availability_day_parts,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'starts_at', slot.starts_at,
            'ends_at', slot.ends_at
          )
          order by slot.starts_at
        )
        from public.expand_user_availability(
          c.user_id,
          v_near_term_start,
          v_near_term_end
        ) as slot
      ),
      '[]'::jsonb
    ) as near_term_slots,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'starts_at', overlap.starts_at,
            'ends_at', overlap.ends_at
          )
          order by overlap.starts_at
        )
        from (
          select
            greatest(a.starts_at, b.starts_at) as starts_at,
            least(a.ends_at, b.ends_at) as ends_at
          from public.expand_user_availability(
            c.user_id,
            v_near_term_start,
            v_near_term_end
          ) as a
          cross join public.expand_user_availability(
            v_viewer_id,
            v_near_term_start,
            v_near_term_end
          ) as b
          where greatest(a.starts_at, b.starts_at) < least(a.ends_at, b.ends_at)
            and extract(
              epoch from (
                least(a.ends_at, b.ends_at) - greatest(a.starts_at, b.starts_at)
              )
            ) >= 3600
        ) as overlap
      ),
      '[]'::jsonb
    ) as near_term_overlap_slots
  from candidates as c
  -- Earliest shared slot across the whole horizon. near_term_overlap_slots
  -- already covers the next three days; this is what prefills the match time
  -- when the viewer taps through to create a match, so it must look further.
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

create or replace function public.get_public_player_card(p_user_id uuid)
returns public.discover_compatible_player_card
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_viewer_band public.skill_band;
  v_viewer_intent public.play_intent;
  v_range_start timestamptz := now();
  v_range_end timestamptz := now() + interval '14 days';
  v_near_term_start timestamptz := now();
  v_near_term_end timestamptz := (
    (date_trunc('day', now() at time zone 'Asia/Beirut') + interval '3 days')
    at time zone 'Asia/Beirut'
  );
  v_card public.discover_compatible_player_card;
begin
  v_viewer_id := public.assert_discovery_caller_eligible();

  if p_user_id = v_viewer_id then
    raise exception using
      errcode = '42501',
      message = 'Cannot load own public card via this RPC';
  end if;

  select pp.skill_band, pp.play_intent
  into v_viewer_band, v_viewer_intent
  from public.player_profiles as pp
  where pp.user_id = v_viewer_id;

  select
    p.id,
    p.display_name,
    p.avatar_path,
    pp.skill_band,
    pp.play_intent,
    pp.prefers_singles,
    pp.prefers_doubles,
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
      where pz.user_id = p.id
        and z.is_active = true
    ),
    case
      when pp.rated_match_count < 5 then 'provisional'
      else 'established'
    end,
    public.completed_match_count_for_user(p.id),
    abs(
      public.skill_band_rank(pp.skill_band)
      - public.skill_band_rank(v_viewer_band)
    ) <= 1,
    exists (
      select 1
      from public.player_zones as viewer_zones
      join public.player_zones as candidate_zones
        on candidate_zones.zone_id = viewer_zones.zone_id
      where viewer_zones.user_id = v_viewer_id
        and candidate_zones.user_id = p.id
    ),
    public.has_availability_overlap(
      v_viewer_id,
      p.id,
      v_range_start,
      v_range_end
    ),
    (pp.play_intent = v_viewer_intent or pp.play_intent = 'either' or v_viewer_intent = 'either'),
    (pp.prefers_singles or pp.prefers_doubles),
    case
      when pp.rated_match_count >= 5 then pp.internal_rating
      else null
    end,
    ov.starts_at,
    ov.ends_at,
    pp.bio,
    coalesce(
      (
        select jsonb_agg(distinct aw.weekday order by aw.weekday)
        from public.availability_windows as aw
        where aw.user_id = p.id
          and aw.is_recurring = true
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(distinct part order by part)
        from (
          select public.availability_day_part_from_local(aw.local_start) as part
          from public.availability_windows as aw
          where aw.user_id = p.id
            and aw.is_recurring = true
        ) as parts
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'starts_at', slot.starts_at,
            'ends_at', slot.ends_at
          )
          order by slot.starts_at
        )
        from public.expand_user_availability(
          p.id,
          v_near_term_start,
          v_near_term_end
        ) as slot
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'starts_at', overlap.starts_at,
            'ends_at', overlap.ends_at
          )
          order by overlap.starts_at
        )
        from (
          select
            greatest(a.starts_at, b.starts_at) as starts_at,
            least(a.ends_at, b.ends_at) as ends_at
          from public.expand_user_availability(
            p.id,
            v_near_term_start,
            v_near_term_end
          ) as a
          cross join public.expand_user_availability(
            v_viewer_id,
            v_near_term_start,
            v_near_term_end
          ) as b
          where greatest(a.starts_at, b.starts_at) < least(a.ends_at, b.ends_at)
            and extract(
              epoch from (
                least(a.ends_at, b.ends_at) - greatest(a.starts_at, b.starts_at)
              )
            ) >= 3600
        ) as overlap
      ),
      '[]'::jsonb
    )
  into v_card
  from public.profiles as p
  join public.player_profiles as pp on pp.user_id = p.id
  -- Same horizon as the discover list, so the public card and the card the
  -- viewer tapped through from agree on the earliest shared slot.
  left join lateral public.first_availability_overlap(
    v_viewer_id,
    p.id,
    v_range_start,
    v_range_end
  ) as ov on true
  where p.id = p_user_id
    and p.account_status = 'active'
    and p.onboarding_completed_at is not null
    and p.is_adult_confirmed = true
    and not public.is_blocked(v_viewer_id, p.id);

  if v_card.user_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Player not found';
  end if;

  return v_card;
end;
$$;
