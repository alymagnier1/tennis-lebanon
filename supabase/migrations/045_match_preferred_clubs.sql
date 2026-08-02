-- A player joins a match knowing only a zone. A zone holds several clubs a
-- half-hour apart at different prices, and the venue only becomes visible once
-- somebody books it: get_match_hub (033:427) exposes a club name solely through
-- the booking payload, which does not exist until a court is requested. So the
-- first time a joiner learns where they are playing is after the decision was
-- made without them.
--
-- The host now names one to three candidate clubs at creation, joiners see them
-- in discovery and on the hub before they commit, and confirm_external_court
-- announces a court booked anywhere else. Public matches must name at least one
-- club; a private match among people who already know where they play may skip
-- it and fall back to zones.
--
-- An off-list court stays legal rather than being rejected. The shortlisted club
-- being full at the agreed hour is the ordinary reason somebody rings a second
-- club, and blocking that rebuilds the stranded match that 034 and 041 exist to
-- prevent. It is announced instead, so nobody arrives at a venue they never saw.
--
-- Per-joiner club approval with an agreed shortlist as the intersection was the
-- alternative. It deadlocks: four players each accepting a subset of three clubs
-- frequently share none, and the match then stalls before the roster is even
-- full. The host's list is authoritative and joining is consent to it.
--
-- match_zones (001:189) is the shape being mirrored, including its access model:
-- RLS on, no policy, no grant (003:40), reachable only through security definer
-- RPCs. So the clubs ride inside the existing hub and discovery payloads rather
-- than being fetched separately.

create table if not exists public.match_preferred_clubs (
  match_id uuid not null references public.matches(id) on delete cascade,
  club_id uuid not null references public.clubs(id),
  primary key (match_id, club_id)
);

alter table public.match_preferred_clubs enable row level security;

revoke all on table public.match_preferred_clubs from public, anon, authenticated;

comment on table public.match_preferred_clubs is
  'Clubs the host named at creation as acceptable venues. Visible to joiners before they commit; not a constraint on where the court is eventually booked.';

-- ---------------------------------------------------------------------------
-- 1. Creation takes the shortlist
--
-- Adding a parameter creates an overload rather than replacing the function, so
-- the previous signatures are dropped first (033:1053).
-- ---------------------------------------------------------------------------

drop function if exists public.create_and_publish_match(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text
);

drop function if exists public.create_match_draft(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text
);

create or replace function public.create_match_draft(
  p_format public.match_format,
  p_visibility public.match_visibility,
  p_intent public.play_intent,
  p_min_skill public.skill_band,
  p_max_skill public.skill_band,
  p_requires_creator_approval boolean,
  p_notes text default null,
  p_zone_ids uuid[] default '{}'::uuid[],
  p_proposed_times jsonb default '[]'::jsonb,
  p_timing_mode text default 'fixed',
  p_preferred_club_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match_id uuid;
  v_time record;
  v_timing_mode text;
  v_time_count integer;
  v_club_ids uuid[];
begin
  v_user_id := public.assert_marketplace_caller();
  v_timing_mode := coalesce(nullif(trim(p_timing_mode), ''), 'fixed');

  if v_timing_mode not in ('fixed', 'flexible') then
    raise exception using errcode = '22023', message = 'Unsupported timing mode';
  end if;

  if exists (
    select 1
    from public.matches as m
    where m.creator_id = v_user_id
      and m.format = p_format
      and m.status in ('draft', 'open', 'full', 'ready_to_book')
  ) then
    raise exception using errcode = 'P0001', message = 'active_hosted_match_exists';
  end if;

  if public.skill_band_rank(p_min_skill) > public.skill_band_rank(p_max_skill) then
    raise exception using errcode = '22023', message = 'Invalid skill range';
  end if;

  if p_zone_ids is null or cardinality(p_zone_ids) = 0 then
    raise exception using errcode = '22023', message = 'At least one zone is required';
  end if;

  perform public.assert_active_zones(p_zone_ids);

  -- Duplicates would collide with the composite primary key, and the host
  -- tapping the same club twice is a UI slip rather than an error worth showing.
  select coalesce(array_agg(distinct club_id), '{}'::uuid[])
  into v_club_ids
  from unnest(coalesce(p_preferred_club_ids, '{}'::uuid[])) as club_id;

  if cardinality(v_club_ids) > 3 then
    raise exception using errcode = '22023', message = 'At most three preferred clubs';
  end if;

  -- A public listing that names only a zone leaves a joiner deciding whether to
  -- drive without knowing where. Private and invite-only matches are among
  -- people who already know, so they may skip it.
  if p_visibility = 'public' and cardinality(v_club_ids) = 0 then
    raise exception using errcode = '22023', message = 'preferred_club_required';
  end if;

  if exists (
    select 1
    from unnest(v_club_ids) as club_id
    where not exists (
      select 1
      from public.clubs as c
      where c.id = club_id
        and c.is_active = true
    )
  ) then
    raise exception using errcode = 'P0002', message = 'Preferred club not found';
  end if;

  if jsonb_typeof(p_proposed_times) <> 'array' then
    raise exception using errcode = '22023', message = 'Proposed times must be an array';
  end if;

  v_time_count := jsonb_array_length(p_proposed_times);

  if v_timing_mode = 'fixed' then
    if v_time_count <> 1 then
      raise exception using errcode = '22023', message = 'A fixed match needs exactly one time';
    end if;
  elsif v_time_count < 1 or v_time_count > 3 then
    raise exception using errcode = '22023', message = 'Provide between 1 and 3 proposed times';
  end if;

  insert into public.matches (
    creator_id,
    format,
    visibility,
    status,
    intent,
    min_skill,
    max_skill,
    requires_creator_approval,
    notes,
    timing_mode
  )
  values (
    v_user_id,
    p_format,
    p_visibility,
    'draft',
    p_intent,
    p_min_skill,
    p_max_skill,
    coalesce(p_requires_creator_approval, false),
    p_notes,
    v_timing_mode
  )
  returning id into v_match_id;

  insert into public.match_participants (
    match_id,
    user_id,
    status,
    is_creator,
    joined_at
  )
  values (v_match_id, v_user_id, 'accepted', true, now());

  insert into public.match_zones (match_id, zone_id)
  select v_match_id, zone_id
  from unnest(p_zone_ids) as zone_id;

  insert into public.match_preferred_clubs (match_id, club_id)
  select v_match_id, club_id
  from unnest(v_club_ids) as club_id;

  for v_time in
    select
      (value ->> 'starts_at')::timestamptz as starts_at,
      (value ->> 'ends_at')::timestamptz as ends_at
    from jsonb_array_elements(p_proposed_times)
  loop
    if v_time.starts_at is null
       or v_time.ends_at is null
       or v_time.ends_at <= v_time.starts_at
       or v_time.ends_at <= now() then
      raise exception using errcode = '22023', message = 'Invalid proposed time';
    end if;

    insert into public.match_time_options (
      match_id,
      starts_at,
      ends_at,
      proposed_by
    )
    values (v_match_id, v_time.starts_at, v_time.ends_at, v_user_id);
  end loop;

  return v_match_id;
end;
$$;

create or replace function public.create_and_publish_match(
  p_format public.match_format,
  p_visibility public.match_visibility,
  p_intent public.play_intent,
  p_min_skill public.skill_band,
  p_max_skill public.skill_band,
  p_requires_creator_approval boolean,
  p_notes text default null,
  p_zone_ids uuid[] default '{}'::uuid[],
  p_proposed_times jsonb default '[]'::jsonb,
  p_timing_mode text default 'fixed',
  p_preferred_club_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_match_id uuid;
begin
  v_match_id := public.create_match_draft(
    p_format,
    p_visibility,
    p_intent,
    p_min_skill,
    p_max_skill,
    p_requires_creator_approval,
    p_notes,
    p_zone_ids,
    p_proposed_times,
    p_timing_mode,
    p_preferred_club_ids
  );

  perform public.publish_match(v_match_id);
  return v_match_id;
end;
$$;

revoke all on function public.create_match_draft(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text, uuid[]
) from public, anon;
grant execute on function public.create_match_draft(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text, uuid[]
) to authenticated;

revoke all on function public.create_and_publish_match(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text, uuid[]
) from public, anon;
grant execute on function public.create_and_publish_match(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text, uuid[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The hub carries the shortlist
--
-- get_match_hub already admits a non-participant to a public match in
-- open/full/ready_to_book (033:406), which is the surface a prospective joiner
-- reads. Nothing new is exposed: club name, zone and booking mode are already
-- public through the clubs directory.
-- ---------------------------------------------------------------------------

alter type public.match_hub_card
  add attribute preferred_clubs jsonb;

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
  v_has_pending_requests boolean;
  v_booking jsonb;
  v_result jsonb;
  v_viewer_attendance public.attendance_status;
  v_result_row public.match_results%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  select mp.status, mp.is_creator, mp.attendance
  into v_participant_status, v_is_creator, v_viewer_attendance
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id
    and mp.status in ('accepted', 'requested', 'invited');

  if v_participant_status is null
     and v_match.visibility = 'public'
     and v_match.status in ('open', 'full', 'ready_to_book') then
    null;
  elsif v_participant_status is null then
    raise exception using errcode = '42501', message = 'Not authorized to view this match';
  end if;

  select exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'requested'
  )
  into v_has_pending_requests;

  select p.display_name
  into v_card.creator_display_name
  from public.profiles as p
  where p.id = v_match.creator_id;

  select jsonb_build_object(
    'booking_id', b.id,
    'status', b.status,
    'court_id', b.court_id,
    'court_name', ct.name,
    'club_id', c.id,
    'club_name', c.name,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'price_minor', b.price_minor,
    'currency', b.currency,
    'payment_method', b.payment_method,
    'club_note', b.club_note,
    'proposed_court_id', b.proposed_court_id,
    'proposed_court_name', pct.name,
    'proposed_start_at', b.proposed_start_at,
    'proposed_end_at', b.proposed_end_at
  )
  into v_booking
  from public.bookings as b
  join public.courts as ct on ct.id = b.court_id
  join public.clubs as c on c.id = ct.club_id
  left join public.courts as pct on pct.id = b.proposed_court_id
  where b.match_id = p_match_id
    and b.status in ('requested', 'alternative_proposed', 'accepted')
  order by b.created_at desc
  limit 1;

  select *
  into v_result_row
  from public.match_results as mr
  where mr.match_id = p_match_id;

  if found then
    v_result := jsonb_build_object(
      'result_id', v_result_row.id,
      'status', v_result_row.status,
      'submitted_by', v_result_row.submitted_by,
      'score', v_result_row.score,
      'winner_user_id', v_result_row.winner_user_id,
      'confirmed_by', v_result_row.confirmed_by,
      'dispute_note', v_result_row.dispute_note
    );
  end if;

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
  v_card.timing_mode := v_match.timing_mode;
  v_card.participant_count := public.match_participant_count(v_match.id);
  v_card.capacity := public.match_capacity_for_format(v_match.format);
  v_card.selected_time_option_id := v_match.selected_time_option_id;
  v_card.booking := v_booking;
  v_card.result := v_result;
  v_card.viewer_attendance := coalesce(v_viewer_attendance, 'unknown'::public.attendance_status);
  v_card.listing_expires_at := public.match_listing_expires_at(
    v_match.created_at,
    v_match.listing_extended_at
  );
  v_card.is_stale_warning := public.match_is_stale_warning(p_match_id);
  v_card.can_extend_listing := coalesce(v_is_creator, false)
    and v_match.status in ('open', 'full')
    and v_card.is_stale_warning;
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
  v_card.preferred_clubs := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'club_id', c.id,
          'name', c.name,
          'booking_mode', c.booking_mode
        )
        order by c.name
      ),
      '[]'::jsonb
    )
    from public.match_preferred_clubs as mpc
    join public.clubs as c on c.id = mpc.club_id
    where mpc.match_id = v_match.id
      and c.is_active = true
  );
  v_card.proposed_times := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', mto.id,
          'starts_at', mto.starts_at,
          'ends_at', mto.ends_at,
          'yes_count', (
            select count(*)::integer
            from public.match_time_votes as mtv
            join public.match_participants as mp
              on mp.user_id = mtv.user_id
             and mp.match_id = p_match_id
             and mp.status = 'accepted'
            where mtv.time_option_id = mto.id
              and mtv.vote = 'yes'
          ),
          'required_count', public.match_participant_count(p_match_id),
          'viewer_vote', (
            select mtv.vote::text
            from public.match_time_votes as mtv
            where mtv.time_option_id = mto.id
              and mtv.user_id = v_user_id
          )
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
          'is_creator', mp.is_creator,
          'attendance', mp.attendance
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

  if v_is_creator and v_match.status = 'draft' then
    v_card.next_action := 'publish_match';
  elsif v_participant_status = 'accepted'
     and v_booking is not null
     and (v_booking->>'status') = 'alternative_proposed'
     and v_is_creator then
    v_card.next_action := 'review_alternative';
  elsif v_match.status = 'booking_pending' then
    v_card.next_action := 'awaiting_club';
  elsif v_match.status = 'confirmed' then
    v_card.next_action := 'pay_at_club';
  elsif v_match.status = 'in_progress'
     and v_participant_status = 'accepted'
     and coalesce(v_viewer_attendance, 'unknown') = 'unknown' then
    v_card.next_action := 'record_attendance';
  elsif v_match.status = 'in_progress'
     and v_participant_status = 'accepted'
     and v_result is null then
    v_card.next_action := 'submit_result';
  elsif v_match.status = 'in_progress'
     and v_participant_status = 'accepted'
     and v_result is not null
     and (v_result->>'status') = 'submitted'
     and (v_result->>'submitted_by')::uuid <> v_user_id then
    v_card.next_action := 'confirm_result';
  elsif v_match.status = 'completed'
     and v_result is not null
     and (v_result->>'status') = 'disputed' then
    v_card.next_action := 'result_disputed';
  elsif v_match.status = 'completed' then
    v_card.next_action := 'view_completed';
  elsif v_is_creator and v_match.status = 'ready_to_book' then
    v_card.next_action := 'request_court';
  elsif v_participant_status = 'accepted' and v_match.status = 'ready_to_book' then
    v_card.next_action := 'time_agreed';
  elsif v_is_creator and v_has_pending_requests and v_match.status in ('open', 'full') then
    v_card.next_action := 'manage_requests';
  elsif v_participant_status = 'accepted' and v_match.status in ('open', 'full') then
    -- Nothing is up for a vote on a fixed match; the roster is what is missing.
    v_card.next_action := case
      when v_match.timing_mode = 'fixed' then 'awaiting_players'
      else 'vote_on_times'
    end;
  elsif v_participant_status is null and v_match.status = 'open' then
    v_card.next_action := case
      when v_match.requires_creator_approval then 'request_to_join'
      else 'join_match'
    end;
  else
    v_card.next_action := 'view_match';
  end if;

  return v_card;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Discovery carries the shortlist
--
-- The live definition is 009:177, not 033: 032 and 033 never redefine this
-- function. Copied forward from there with the clubs aggregate added beside the
-- existing zones subquery.
-- ---------------------------------------------------------------------------

alter type public.discover_open_match_card
  add attribute preferred_clubs jsonb;

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
    em.notes,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'club_id', c.id,
            'name', c.name,
            'booking_mode', c.booking_mode
          )
          order by c.name
        ),
        '[]'::jsonb
      )
      from public.match_preferred_clubs as mpc
      join public.clubs as c on c.id = mpc.club_id
      where mpc.match_id = em.id
        and c.is_active = true
    ) as preferred_clubs
  from eligible_matches as em
  order by
    em.soonest_time asc nulls last,
    (em.capacity - em.participant_count) asc,
    em.created_at desc
  limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. A court booked off the list is announced
--
-- Copied forward from 041:25. Two changes: the notification names the club and
-- the local time instead of saying only that "a court has been arranged", which
-- was the whole reason the other players had no idea where they were playing;
-- and a club outside the agreed shortlist says so, in the message and in the
-- audit trail.
--
-- Beirut rather than UTC because this is display text for a human. Matches with
-- no shortlist are never off-list, so nothing changes for them.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_external_court(
  p_match_id uuid,
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_court public.courts%rowtype;
  v_club public.clubs%rowtype;
  v_booking_id uuid;
  v_note text;
  v_pending record;
  v_has_shortlist boolean;
  v_off_shortlist boolean;
  v_when text;
  v_body text;
begin
  v_user_id := public.assert_marketplace_caller();
  v_note := nullif(trim(coalesce(p_note, '')), '');

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  -- Any accepted participant, not just the creator.
  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only a match participant can confirm a court';
  end if;

  if v_match.status not in ('ready_to_book', 'booking_pending') then
    raise exception using errcode = 'P0001', message = 'Match is not ready to book';
  end if;

  perform public.assert_match_roster_full(p_match_id);

  -- An accepted booking means a court is already secured through the app.
  -- Nothing is stuck, so this stays an error rather than being superseded.
  if exists (
    select 1
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status = 'accepted'
  ) then
    raise exception using errcode = 'P0001', message = 'An active booking already exists for this match';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at <= now() then
    raise exception using errcode = '22023', message = 'Invalid court time';
  end if;

  select *
  into v_court
  from public.courts as ct
  where ct.id = p_court_id
    and ct.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Court not found';
  end if;

  select *
  into v_club
  from public.clubs as c
  where c.id = v_court.club_id
    and c.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if public.court_has_block(v_court.id, p_starts_at, p_ends_at) then
    raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
  end if;

  select exists (
    select 1
    from public.match_preferred_clubs as mpc
    where mpc.match_id = p_match_id
  )
  into v_has_shortlist;

  v_off_shortlist := v_has_shortlist and not exists (
    select 1
    from public.match_preferred_clubs as mpc
    where mpc.match_id = p_match_id
      and mpc.club_id = v_club.id
  );

  -- Withdraw anything still sitting with the club, in this transaction rather
  -- than as a separate client call. one_active_booking_per_match means the
  -- insert below cannot succeed while a request is outstanding, so this is what
  -- makes the booking_pending case work at all -- and because it shares the
  -- transaction, a court that turns out to be blocked or mistimed rolls the
  -- withdrawal back rather than leaving the match with neither.
  -- accept_booking requires status 'requested', so once cancelled the club can
  -- no longer act on the superseded request either.
  for v_pending in
    select b.id, b.status
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status in ('requested', 'alternative_proposed')
    for update
  loop
    update public.bookings
    set status = 'cancelled',
        acted_by = v_user_id,
        acted_at = now(),
        updated_at = now()
    where id = v_pending.id;

    perform public.append_booking_event(
      v_pending.id,
      v_pending.status,
      'cancelled',
      v_user_id,
      v_note,
      jsonb_build_object('superseded_by', 'external_court')
    );
  end loop;

  begin
    insert into public.bookings (
      match_id,
      court_id,
      requested_by,
      status,
      starts_at,
      ends_at,
      price_minor,
      currency,
      payment_method,
      club_note,
      arranged_externally,
      acted_by,
      acted_at
    )
    values (
      p_match_id,
      v_court.id,
      v_user_id,
      'accepted',
      p_starts_at,
      p_ends_at,
      v_court.price_minor,
      v_court.currency,
      'pay_at_club',
      v_note,
      true,
      v_user_id,
      now()
    )
    returning id into v_booking_id;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'court_already_booked';
  end;

  perform public.append_booking_event(
    v_booking_id,
    null,
    'accepted',
    v_user_id,
    v_note,
    jsonb_build_object(
      'court_id', v_court.id,
      'club_id', v_club.id,
      'arranged_externally', true,
      'off_preferred_list', v_off_shortlist
    )
  );

  update public.matches
  set status = 'confirmed', updated_at = now()
  where id = p_match_id
    and status in ('ready_to_book', 'booking_pending');

  -- Now that someone other than the creator can do this, silence would leave
  -- the rest of the group still believing the match is waiting on a court.
  -- Naming the club and the hour is the point: "a court has been arranged" told
  -- them a booking existed without telling them where to turn up.
  v_when := to_char(p_starts_at at time zone 'Asia/Beirut', 'Dy DD Mon, HH24:MI');

  v_body := case
    when v_off_shortlist then format(
      '%s at %s. This club was not on the list agreed when players joined.',
      v_club.name,
      v_when
    )
    else format(
      '%s at %s. Your match is confirmed.',
      v_club.name,
      v_when
    )
  end;

  perform public.enqueue_notification(
    mp.user_id,
    'match_court_confirmed',
    'match',
    p_match_id,
    format('external_court:%s:%s', v_booking_id, mp.user_id),
    jsonb_build_object(
      'deepLink', format('/match/%s', p_match_id),
      'title', 'Court confirmed',
      'body', v_body
    ),
    now()
  )
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.status = 'accepted'
    and mp.user_id <> v_user_id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_user_id,
    'court_arranged_externally',
    'match',
    p_match_id,
    v_note,
    jsonb_build_object(
      'club_id', v_club.id,
      'court_id', v_court.id,
      'off_preferred_list', v_off_shortlist
    )
  );

  return v_booking_id;
end;
$$;

revoke all on function public.confirm_external_court(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.confirm_external_court(uuid, uuid, timestamptz, timestamptz, text)
  to authenticated;
