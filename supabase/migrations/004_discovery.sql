-- Milestone 2: availability management and discovery RPCs.

create or replace function public.skill_band_rank(p_band public.skill_band)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_band
    when 'beginner' then 1
    when 'improving' then 2
    when 'intermediate' then 3
    when 'advanced' then 4
    when 'competitive' then 5
  end;
$$;

alter table public.matches
  add constraint matches_skill_range_check
  check (
    public.skill_band_rank(min_skill) <= public.skill_band_rank(max_skill)
  );

create table public.discovery_search_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  surface text not null check (surface in ('open_matches', 'compatible_players')),
  searched_at timestamptz not null default now()
);

alter table public.discovery_search_log enable row level security;
revoke all on table public.discovery_search_log from public, anon, authenticated;

create index discovery_search_log_user_recent_idx
  on public.discovery_search_log (user_id, searched_at desc);

create index player_zones_zone_user_idx
  on public.player_zones (zone_id, user_id);

create index match_zones_zone_match_idx
  on public.match_zones (zone_id, match_id);

create index availability_windows_user_idx
  on public.availability_windows (user_id);

create index matches_open_public_idx
  on public.matches (created_at desc)
  where status = 'open' and visibility = 'public';

create or replace function public.is_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_blocks as ub
    where (ub.blocker_id = p_user_a and ub.blocked_id = p_user_b)
       or (ub.blocker_id = p_user_b and ub.blocked_id = p_user_a)
  );
$$;

create or replace function public.match_participant_count(p_match_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.status = 'accepted';
$$;

create or replace function public.assert_discovery_caller_eligible()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select *
  into v_profile
  from public.profiles as p
  where p.id = v_user_id;

  if not found
     or v_profile.account_status <> 'active'
     or v_profile.onboarding_completed_at is null
     or v_profile.is_adult_confirmed is distinct from true then
    raise exception using
      errcode = '42501',
      message = 'Caller is not marketplace-eligible';
  end if;

  return v_user_id;
end;
$$;

create or replace function public.enforce_discovery_rate_limit(
  p_user_id uuid,
  p_surface text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_recent_count integer;
begin
  select count(*)
  into v_recent_count
  from public.discovery_search_log as dsl
  where dsl.user_id = p_user_id
    and dsl.searched_at > now() - interval '1 minute';

  if v_recent_count >= 30 then
    raise exception using
      errcode = 'P0001',
      message = 'discovery_rate_limited';
  end if;

  insert into public.discovery_search_log (user_id, surface)
  values (p_user_id, p_surface);
end;
$$;

create or replace function public.expand_user_availability(
  p_user_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_window record;
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
begin
  for v_window in
    select aw.starts_at, aw.ends_at
    from public.availability_windows as aw
    where aw.user_id = p_user_id
      and aw.is_recurring = false
      and aw.ends_at > p_range_start
      and aw.starts_at < p_range_end
  loop
    starts_at := greatest(v_window.starts_at, p_range_start);
    ends_at := least(v_window.ends_at, p_range_end);
    if ends_at > starts_at then
      return next;
    end if;
  end loop;

  v_day := (p_range_start at time zone 'Asia/Beirut')::date;
  while v_day <= (p_range_end at time zone 'Asia/Beirut')::date loop
    for v_window in
      select
        aw.weekday,
        aw.local_start,
        aw.local_end,
        aw.timezone,
        aw.valid_from,
        aw.valid_until
      from public.availability_windows as aw
      where aw.user_id = p_user_id
        and aw.is_recurring = true
        and aw.weekday = extract(dow from v_day)::smallint
        and (aw.valid_from is null or v_day >= aw.valid_from)
        and (aw.valid_until is null or v_day <= aw.valid_until)
    loop
      v_start := (v_day + v_window.local_start)
        at time zone coalesce(v_window.timezone, 'Asia/Beirut');
      v_end := (v_day + v_window.local_end)
        at time zone coalesce(v_window.timezone, 'Asia/Beirut');
      starts_at := greatest(v_start, p_range_start);
      ends_at := least(v_end, p_range_end);
      if ends_at > starts_at then
        return next;
      end if;
    end loop;
    v_day := v_day + 1;
  end loop;
end;
$$;

create or replace function public.has_availability_overlap(
  p_user_a uuid,
  p_user_b uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.expand_user_availability(p_user_a, p_range_start, p_range_end) as a
    cross join public.expand_user_availability(p_user_b, p_range_start, p_range_end) as b
    where greatest(a.starts_at, b.starts_at) < least(a.ends_at, b.ends_at)
      and extract(
        epoch from (
          least(a.ends_at, b.ends_at) - greatest(a.starts_at, b.starts_at)
        )
      ) >= 3600
  );
$$;

create or replace function public.viewer_match_time_overlap(
  p_viewer_id uuid,
  p_match_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.expand_user_availability(p_viewer_id, p_range_start, p_range_end) as viewer_slot
    join public.match_time_options as mto
      on mto.match_id = p_match_id
     and mto.withdrawn_at is null
     and mto.ends_at > now()
     and mto.ends_at > p_range_start
     and mto.starts_at < p_range_end
    where greatest(viewer_slot.starts_at, mto.starts_at)
          < least(viewer_slot.ends_at, mto.ends_at)
      and extract(
        epoch from (
          least(viewer_slot.ends_at, mto.ends_at)
          - greatest(viewer_slot.starts_at, mto.starts_at)
        )
      ) >= 3600
  );
$$;

create or replace function public.completed_match_count_for_user(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  where mp.user_id = p_user_id
    and mp.status = 'accepted'
    and m.status = 'completed';
$$;

create type public.discover_compatible_player_card as (
  user_id uuid,
  display_name text,
  avatar_path text,
  skill_band public.skill_band,
  play_intent public.play_intent,
  prefers_singles boolean,
  prefers_doubles boolean,
  zones jsonb,
  provisional_rating_label text,
  completed_match_count integer,
  level_fit boolean,
  zone_overlap boolean,
  availability_overlap boolean,
  intent_fit boolean,
  format_fit boolean
);

create or replace function public.discover_compatible_players(
  p_zone_ids uuid[] default null,
  p_format public.match_format default null,
  p_intent public.play_intent default null,
  p_require_availability_overlap boolean default true,
  p_horizon_days integer default 14,
  p_level_window integer default 1,
  p_limit integer default 20,
  p_cursor_user_id uuid default null
)
returns setof public.discover_compatible_player_card
language plpgsql
stable
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
    c.format_fit
  from candidates as c
  order by
    c.availability_overlap desc,
    c.level_distance asc,
    public.completed_match_count_for_user(c.user_id) desc,
    c.user_id asc
  limit v_limit;
end;
$$;

create type public.discover_open_match_card as (
  match_id uuid,
  format public.match_format,
  intent public.play_intent,
  visibility public.match_visibility,
  status public.match_status,
  requires_creator_approval boolean,
  min_skill public.skill_band,
  max_skill public.skill_band,
  zones jsonb,
  proposed_times jsonb,
  participant_count integer,
  capacity integer,
  creator_display_name text,
  creator_avatar_path text,
  level_fit boolean,
  zone_overlap boolean,
  availability_overlap boolean,
  created_at timestamptz
);

create or replace function public.discover_open_matches(
  p_zone_ids uuid[] default null,
  p_format public.match_format default null,
  p_intent public.play_intent default null,
  p_horizon_days integer default 14,
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null
)
returns setof public.discover_open_match_card
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_viewer_band public.skill_band;
  v_zone_ids uuid[];
  v_range_start timestamptz := now();
  v_range_end timestamptz;
  v_limit integer;
begin
  v_viewer_id := public.assert_discovery_caller_eligible();
  perform public.enforce_discovery_rate_limit(v_viewer_id, 'open_matches');

  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_range_end := v_range_start + make_interval(
    days => least(greatest(coalesce(p_horizon_days, 14), 1), 28)
  );

  select pp.skill_band
  into v_viewer_band
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
  with eligible_matches as (
    select
      m.id,
      m.format,
      m.intent,
      m.visibility,
      m.status,
      m.requires_creator_approval,
      m.min_skill,
      m.max_skill,
      m.created_at,
      public.match_participant_count(m.id) as participant_count,
      case when m.format = 'singles' then 2 else 4 end as capacity,
      cp.display_name as creator_display_name,
      cp.avatar_path as creator_avatar_path,
      (
        public.skill_band_rank(v_viewer_band) >= public.skill_band_rank(m.min_skill)
        and public.skill_band_rank(v_viewer_band) <= public.skill_band_rank(m.max_skill)
      ) as level_fit,
      exists (
        select 1
        from public.match_zones as mz
        where mz.match_id = m.id
          and mz.zone_id = any(v_zone_ids)
      ) as zone_overlap,
      public.viewer_match_time_overlap(
        v_viewer_id,
        m.id,
        v_range_start,
        v_range_end
      ) as availability_overlap,
      (
        select min(mto.starts_at)
        from public.match_time_options as mto
        where mto.match_id = m.id
          and mto.withdrawn_at is null
          and mto.ends_at > now()
      ) as soonest_time
    from public.matches as m
    join public.profiles as cp on cp.id = m.creator_id
    where m.status = 'open'
      and m.visibility = 'public'
      and not public.is_blocked(v_viewer_id, m.creator_id)
      and not exists (
        select 1
        from public.match_participants as mp
        where mp.match_id = m.id
          and mp.user_id = v_viewer_id
      )
      and public.skill_band_rank(v_viewer_band) >= public.skill_band_rank(m.min_skill)
      and public.skill_band_rank(v_viewer_band) <= public.skill_band_rank(m.max_skill)
      and (
        cardinality(v_zone_ids) = 0
        or exists (
          select 1
          from public.match_zones as mz
          where mz.match_id = m.id
            and mz.zone_id = any(v_zone_ids)
        )
      )
      and public.match_participant_count(m.id) < case when m.format = 'singles' then 2 else 4 end
      and exists (
        select 1
        from public.match_time_options as mto
        where mto.match_id = m.id
          and mto.withdrawn_at is null
          and mto.ends_at > now()
      )
      and (p_format is null or m.format = p_format)
      and (p_intent is null or m.intent = p_intent)
      and (p_cursor_created_at is null or m.created_at < p_cursor_created_at)
  )
  select
    em.id,
    em.format,
    em.intent,
    em.visibility,
    em.status,
    em.requires_creator_approval,
    em.min_skill,
    em.max_skill,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', z.id,
            'slug', z.slug,
            'name_i18n', z.name_i18n
          )
        ),
        '[]'::jsonb
      )
      from public.match_zones as mz
      join public.zones as z on z.id = mz.zone_id
      where mz.match_id = em.id
    ) as zones,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', mto.id,
            'starts_at', mto.starts_at,
            'ends_at', mto.ends_at
          )
          order by mto.starts_at
        ),
        '[]'::jsonb
      )
      from public.match_time_options as mto
      where mto.match_id = em.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ) as proposed_times,
    em.participant_count,
    em.capacity,
    em.creator_display_name,
    em.creator_avatar_path,
    em.level_fit,
    em.zone_overlap,
    em.availability_overlap,
    em.created_at
  from eligible_matches as em
  order by
    em.soonest_time asc nulls last,
    (em.capacity - em.participant_count) asc,
    em.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.discover_compatible_players(
  uuid[],
  public.match_format,
  public.play_intent,
  boolean,
  integer,
  integer,
  integer,
  uuid
) from public, anon;
grant execute on function public.discover_compatible_players(
  uuid[],
  public.match_format,
  public.play_intent,
  boolean,
  integer,
  integer,
  integer,
  uuid
) to authenticated;

revoke all on function public.discover_open_matches(
  uuid[],
  public.match_format,
  public.play_intent,
  integer,
  integer,
  timestamptz
) from public, anon;
grant execute on function public.discover_open_matches(
  uuid[],
  public.match_format,
  public.play_intent,
  integer,
  integer,
  timestamptz
) to authenticated;

grant select, insert, delete on table public.user_blocks to authenticated;

grant select, insert, update, delete on table public.availability_windows to authenticated;
