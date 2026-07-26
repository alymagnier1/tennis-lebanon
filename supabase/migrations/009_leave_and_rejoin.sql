-- Leave match: reopen discovery for departed players and allow rejoin.

create or replace function public.join_match(p_match_id uuid)
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

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_match_id);

  if v_match.requires_creator_approval then
    v_status := 'requested';
  else
    if v_count >= v_capacity then
      raise exception using errcode = 'P0001', message = 'match_full';
    end if;
    v_status := 'accepted';
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
      left_at = null
    where match_id = p_match_id
      and user_id = v_user_id;
  else
    insert into public.match_participants (
      match_id,
      user_id,
      status,
      is_creator,
      joined_at
    )
    values (
      p_match_id,
      v_user_id,
      v_status,
      false,
      case when v_status = 'accepted' then now() else null end
    );
  end if;

  if v_status = 'accepted' then
    perform public.refresh_match_open_state(p_match_id);
  end if;

  return v_status;
end;
$$;

create or replace function public.accept_match_invite(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_invite public.match_invitations%rowtype;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
  v_status public.participant_status;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_invite
  from public.match_invitations as mi
  where mi.token_hash = public.hash_invite_token(p_token)
    and mi.revoked_at is null
    and mi.accepted_at is null
    and mi.expires_at > now()
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Invite not found or expired';
  end if;

  if v_invite.invited_user_id is not null
     and v_invite.invited_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Invite is for another user';
  end if;

  v_match := public.assert_joinable_match(v_invite.match_id, v_user_id, true);

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = v_invite.match_id
      and mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'already_participant';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(v_invite.match_id);

  if v_count >= v_capacity then
    raise exception using errcode = 'P0001', message = 'match_full';
  end if;

  v_status := 'accepted';

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = v_invite.match_id
      and mp.user_id = v_user_id
      and mp.status in ('left', 'declined', 'removed')
  ) then
    update public.match_participants
    set
      status = v_status,
      joined_at = now(),
      left_at = null
    where match_id = v_invite.match_id
      and user_id = v_user_id;
  else
    insert into public.match_participants (
      match_id,
      user_id,
      status,
      is_creator,
      joined_at
    )
    values (
      v_invite.match_id,
      v_user_id,
      v_status,
      false,
      now()
    );
  end if;

  update public.match_invitations
  set accepted_at = now()
  where id = v_invite.id;

  perform public.refresh_match_open_state(v_invite.match_id);
  return v_invite.match_id;
end;
$$;

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
          and mp.status in ('accepted', 'requested', 'invited')
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
