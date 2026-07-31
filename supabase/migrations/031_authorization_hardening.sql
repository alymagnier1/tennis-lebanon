-- Milestone 8.8: authorization hardening from the pre-pilot security audit.
--
-- SEC-001 Club registration created an immediately-active, player-visible club
--         for any authenticated caller. Clubs now start inactive and require a
--         platform-operator decision before players can see or book them.
-- SEC-002 Club role checks ignored account_status, so a suspended user kept
--         full club-staff powers.
-- SEC-003 is_platform_operator(uuid) let any caller probe whether an arbitrary
--         account is a platform admin.
-- SEC-004 Blocks were only enforced against the match creator, so a blocked
--         user could still join a match containing the person who blocked them.
-- Zone    create_match_draft never checked zones.is_active, so a match could
--         target a retired zone and become undiscoverable.

-- ---------------------------------------------------------------------------
-- SEC-002: club role checks must respect account status
-- ---------------------------------------------------------------------------

create or replace function public.is_club_staff(p_club_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships as cm
    join public.profiles as p on p.id = cm.user_id
    where cm.club_id = p_club_id
      and cm.user_id = p_user_id
      and cm.is_active = true
      and cm.role in ('staff', 'admin')
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_club_admin(
  p_club_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships as cm
    join public.profiles as p on p.id = cm.user_id
    where cm.club_id = p_club_id
      and cm.user_id = p_user_id
      and cm.is_active = true
      and cm.role = 'admin'
      and p.account_status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- SEC-003: clients get a no-argument form only; the probe-able overload is
-- reserved for internal callers.
-- ---------------------------------------------------------------------------

create or replace function public.viewer_is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_operator(auth.uid());
$$;

revoke all on function public.is_platform_operator(uuid) from public, anon, authenticated;
revoke all on function public.viewer_is_platform_operator() from public, anon;
grant execute on function public.viewer_is_platform_operator() to authenticated;

-- ---------------------------------------------------------------------------
-- SEC-004: blocks apply to the whole roster, not just the creator
-- ---------------------------------------------------------------------------

create or replace function public.is_blocked_from_match(
  p_viewer_id uuid,
  p_match_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status in ('accepted', 'requested', 'invited')
      and public.is_blocked(p_viewer_id, mp.user_id)
  );
$$;

revoke all on function public.is_blocked_from_match(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_from_match(uuid, uuid) to authenticated;

create or replace function public.assert_joinable_match(
  p_match_id uuid,
  p_viewer_id uuid,
  p_allow_non_public boolean default false
)
returns public.matches
language plpgsql
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_viewer_band public.skill_band;
begin
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.status not in ('open', 'full') then
    raise exception using errcode = 'P0001', message = 'match_not_joinable';
  end if;

  if not p_allow_non_public and v_match.visibility <> 'public' then
    raise exception using errcode = '42501', message = 'Match is not publicly joinable';
  end if;

  -- SEC-004: previously only compared against v_match.creator_id.
  if public.is_blocked_from_match(p_viewer_id, p_match_id) then
    raise exception using errcode = '42501', message = 'Blocked relationship';
  end if;

  select pp.skill_band
  into v_viewer_band
  from public.player_profiles as pp
  where pp.user_id = p_viewer_id;

  if public.skill_band_rank(v_viewer_band) < public.skill_band_rank(v_match.min_skill)
     or public.skill_band_rank(v_viewer_band) > public.skill_band_rank(v_match.max_skill) then
    raise exception using errcode = 'P0001', message = 'skill_out_of_range';
  end if;

  if not exists (
    select 1
    from public.match_time_options as mto
    where mto.match_id = p_match_id
      and mto.withdrawn_at is null
      and mto.ends_at > now()
  ) then
    raise exception using errcode = 'P0001', message = 'match_has_no_future_times';
  end if;

  return v_match;
end;
$$;

-- ---------------------------------------------------------------------------
-- SEC-001: clubs require platform approval before becoming player-visible
-- ---------------------------------------------------------------------------

create or replace function public.register_pilot_club(
  p_name text,
  p_slug text,
  p_zone_id uuid,
  p_description text default null,
  p_address_public text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_amenities text[] default '{}'::text[],
  p_courts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_club_id uuid := gen_random_uuid();
  v_court jsonb;
  v_court_id uuid;
  v_weekday integer;
begin
  -- Requires a fully onboarded, active account rather than any authenticated
  -- session: registration creates operational records and an audit trail.
  v_user_id := public.assert_marketplace_caller();

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'Club name is required';
  end if;

  if nullif(trim(coalesce(p_slug, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'Club slug is required';
  end if;

  if exists (
    select 1
    from public.club_memberships as cm
    where cm.user_id = v_user_id
      and cm.is_active = true
      and cm.role = 'admin'
  ) then
    raise exception using errcode = 'P0001', message = 'You already administer a club';
  end if;

  if not exists (
    select 1 from public.zones as z where z.id = p_zone_id and z.is_active = true
  ) then
    raise exception using errcode = 'P0002', message = 'Zone not found';
  end if;

  if jsonb_array_length(coalesce(p_courts, '[]'::jsonb)) < 1 then
    raise exception using errcode = 'P0001', message = 'At least one court is required';
  end if;

  insert into public.clubs (
    id,
    zone_id,
    name,
    slug,
    description,
    address_public,
    latitude,
    longitude,
    booking_mode,
    amenities,
    is_active
  )
  values (
    v_club_id,
    p_zone_id,
    trim(p_name),
    lower(trim(p_slug)),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_address_public, '')), ''),
    p_latitude,
    p_longitude,
    'manual_request',
    coalesce(p_amenities, '{}'::text[]),
    -- SEC-001: pending platform approval; invisible to players until approved.
    false
  );

  insert into public.club_memberships (club_id, user_id, role, is_active)
  values (v_club_id, v_user_id, 'admin', true);

  for v_court in
    select value
    from jsonb_array_elements(coalesce(p_courts, '[]'::jsonb))
  loop
    if nullif(trim(coalesce(v_court->>'name', '')), '') is null then
      raise exception using errcode = 'P0001', message = 'Each court needs a name';
    end if;

    insert into public.courts (
      club_id,
      name,
      surface,
      is_indoor,
      price_minor,
      currency,
      slot_minutes,
      is_active
    )
    values (
      v_club_id,
      trim(v_court->>'name'),
      coalesce(nullif(trim(v_court->>'surface'), ''), 'hard'),
      coalesce((v_court->>'is_indoor')::boolean, false),
      nullif(v_court->>'price_minor', '')::integer,
      coalesce(nullif(trim(v_court->>'currency'), ''), 'USD'),
      coalesce(nullif(v_court->>'slot_minutes', '')::integer, 90),
      true
    )
    returning id into v_court_id;

    for v_weekday in 0..6 loop
      insert into public.court_operating_hours (
        court_id,
        weekday,
        opens_at,
        closes_at
      )
      values (
        v_court_id,
        v_weekday,
        time '07:00',
        time '22:00'
      );
    end loop;
  end loop;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_user_id,
    'club_registration_submitted',
    'club',
    v_club_id,
    jsonb_build_object('slug', lower(trim(p_slug)))
  );

  return v_club_id;
end;
$$;

create or replace function public.list_pending_clubs(p_limit integer default 50)
returns table (
  club_id uuid,
  name text,
  slug text,
  zone_id uuid,
  zone_slug text,
  admin_user_id uuid,
  admin_display_name text,
  court_count integer,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  perform public.assert_platform_operator();
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 200);

  return query
  select
    c.id,
    c.name,
    c.slug,
    c.zone_id,
    z.slug,
    cm.user_id,
    p.display_name,
    (
      select count(*)::integer
      from public.courts as ct
      where ct.club_id = c.id
    ),
    c.created_at
  from public.clubs as c
  join public.zones as z on z.id = c.zone_id
  left join public.club_memberships as cm
    on cm.club_id = c.id
   and cm.role = 'admin'
   and cm.is_active = true
  left join public.profiles as p on p.id = cm.user_id
  where c.is_active = false
  order by c.created_at asc
  limit v_limit;
end;
$$;

create or replace function public.review_pilot_club(
  p_club_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_club public.clubs%rowtype;
  v_reason text;
begin
  v_admin_id := public.assert_platform_operator();
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  select *
  into v_club
  from public.clubs as c
  where c.id = p_club_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if v_club.is_active then
    raise exception using errcode = 'P0001', message = 'Club has already been approved';
  end if;

  if p_approve then
    update public.clubs
    set is_active = true, updated_at = now()
    where id = p_club_id;
  else
    -- Rejection keeps the row for audit history; it simply stays invisible.
    update public.club_memberships
    set is_active = false
    where club_id = p_club_id;
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_admin_id,
    case when p_approve then 'club_approved' else 'club_rejected' end,
    'club',
    p_club_id,
    v_reason,
    jsonb_build_object('slug', v_club.slug)
  );
end;
$$;

revoke all on function public.list_pending_clubs(integer) from public, anon;
grant execute on function public.list_pending_clubs(integer) to authenticated;

revoke all on function public.review_pilot_club(uuid, boolean, text) from public, anon;
grant execute on function public.review_pilot_club(uuid, boolean, text) to authenticated;

-- Staff must still see their club while it awaits approval, otherwise the
-- dashboard looks broken to a club admin who has just registered.
-- Adding a column changes the return type, so the old function must go first.
drop function if exists public.list_staff_clubs();

create or replace function public.list_staff_clubs()
returns table (
  club_id uuid,
  name text,
  slug text,
  role text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  return query
  select
    c.id,
    c.name,
    c.slug,
    cm.role::text,
    c.is_active
  from public.club_memberships as cm
  join public.clubs as c on c.id = cm.club_id
  join public.profiles as p on p.id = cm.user_id
  where cm.user_id = v_user_id
    and cm.is_active = true
    and cm.role in ('staff', 'admin')
    and p.account_status = 'active'
  order by c.name;
end;
$$;

revoke all on function public.list_staff_clubs() from public, anon;
grant execute on function public.list_staff_clubs() to authenticated;

-- ---------------------------------------------------------------------------
-- Zone hygiene: a match must not target a retired zone
-- ---------------------------------------------------------------------------

create or replace function public.assert_active_zones(p_zone_ids uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from unnest(p_zone_ids) as requested(zone_id)
    where not exists (
      select 1
      from public.zones as z
      where z.id = requested.zone_id
        and z.is_active = true
    )
  ) then
    raise exception using errcode = '22023', message = 'Zone is not available';
  end if;
end;
$$;

revoke all on function public.assert_active_zones(uuid[]) from public, anon;
grant execute on function public.assert_active_zones(uuid[]) to authenticated;

create or replace function public.create_match_draft(
  p_format public.match_format,
  p_visibility public.match_visibility,
  p_intent public.play_intent,
  p_min_skill public.skill_band,
  p_max_skill public.skill_band,
  p_requires_creator_approval boolean,
  p_notes text default null,
  p_zone_ids uuid[] default '{}'::uuid[],
  p_proposed_times jsonb default '[]'::jsonb
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
begin
  v_user_id := public.assert_marketplace_caller();

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

  -- Previously only the foreign key guarded this, so a retired zone was
  -- accepted and the match became undiscoverable.
  perform public.assert_active_zones(p_zone_ids);

  if jsonb_typeof(p_proposed_times) <> 'array'
     or jsonb_array_length(p_proposed_times) < 1
     or jsonb_array_length(p_proposed_times) > 3 then
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
    notes
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
    p_notes
  )
  returning id into v_match_id;

  insert into public.match_participants (
    match_id,
    user_id,
    status,
    is_creator,
    joined_at
  )
  values (
    v_match_id,
    v_user_id,
    'accepted',
    true,
    now()
  );

  insert into public.match_zones (match_id, zone_id)
  select v_match_id, zone_id
  from unnest(p_zone_ids) as zone_id;

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
    values (
      v_match_id,
      v_time.starts_at,
      v_time.ends_at,
      v_user_id
    );
  end loop;

  return v_match_id;
end;
$$;
