-- Expose match notes on discover cards and match hub for eligible viewers.

alter type public.discover_open_match_card
  add attribute notes text;

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
volatile
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
      m.notes,
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
    em.created_at,
    em.notes
  from eligible_matches as em
  order by
    em.soonest_time asc nulls last,
    (em.capacity - em.participant_count) asc,
    em.created_at desc
  limit v_limit;
end;
$$;

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
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  select mp.status, mp.is_creator
  into v_participant_status, v_is_creator
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id
    and mp.status in ('accepted', 'requested', 'invited');

  if v_participant_status is null and v_match.visibility = 'public' and v_match.status in ('open', 'full') then
    null;
  elsif v_participant_status is null then
    raise exception using errcode = '42501', message = 'Not authorized to view this match';
  end if;

  select p.display_name
  into v_card.creator_display_name
  from public.profiles as p
  where p.id = v_match.creator_id;

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
  v_card.participant_count := public.match_participant_count(v_match.id);
  v_card.capacity := public.match_capacity_for_format(v_match.format);
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
  v_card.proposed_times := (
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
    where mto.match_id = v_match.id
      and mto.withdrawn_at is null
      and mto.ends_at > now()
  );
  v_card.participants := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', p.id,
          'display_name', p.display_name,
          'status', mp.status,
          'is_creator', mp.is_creator
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

  if v_participant_status = 'accepted' and v_match.status in ('open', 'full') then
    v_card.next_action := 'vote_on_times';
  elsif v_participant_status is null and v_match.status = 'open' then
    v_card.next_action := case
      when v_match.requires_creator_approval then 'request_to_join'
      else 'join_match'
    end;
  elsif v_is_creator and v_match.status in ('open', 'full') then
    v_card.next_action := 'manage_requests';
  else
    v_card.next_action := 'view_match';
  end if;

  return v_card;
end;
$$;

drop function if exists public.list_my_matches();

create or replace function public.list_my_matches()
returns table (
  match_id uuid,
  format public.match_format,
  status public.match_status,
  visibility public.match_visibility,
  intent public.play_intent,
  participant_status public.participant_status,
  is_creator boolean,
  participant_count integer,
  capacity integer,
  soonest_time timestamptz,
  notes text,
  updated_at timestamptz
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
    m.status,
    m.visibility,
    m.intent,
    mp.status,
    mp.is_creator,
    public.match_participant_count(m.id),
    public.match_capacity_for_format(m.format),
    (
      select min(mto.starts_at)
      from public.match_time_options as mto
      where mto.match_id = m.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ),
    m.notes,
    m.updated_at
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  where mp.user_id = v_user_id
    and mp.status in ('accepted', 'requested', 'invited')
    and m.status in ('open', 'full', 'ready_to_book', 'booking_pending', 'confirmed', 'in_progress')
  order by m.updated_at desc;
end;
$$;

revoke all on function public.list_my_matches() from public, anon;
grant execute on function public.list_my_matches() to authenticated;
