-- Operators enter clubs without completing player onboarding.
--
-- 050 already lets a platform operator register clubs with p_as_operator, but
-- it called assert_marketplace_caller() first. That requires an active,
-- adult, onboarded profile. The staging operator is a dashboard password
-- user with platform_roles only — onboarding_completed_at is null — so
-- /onboarding is closed to the one person who has to add the four Beirut
-- venues. Self-service club registration is unchanged.

create or replace function public.register_pilot_club(
  p_name text,
  p_slug text,
  p_zone_id uuid,
  p_description text default null,
  p_address_public text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_amenities text[] default '{}'::text[],
  p_courts jsonb default '[]'::jsonb,
  p_booking_mode text default 'manual_request',
  p_booking_phone text default null,
  p_as_operator boolean default false
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
  v_is_operator boolean;
  v_booking_mode text;
  v_phone text;
begin
  v_is_operator := coalesce(p_as_operator, false);

  if v_is_operator then
    v_user_id := auth.uid();
    if v_user_id is null then
      raise exception using errcode = '42501', message = 'Authentication required';
    end if;
    if not public.viewer_is_platform_operator() then
      raise exception using errcode = '42501', message = 'Platform operator access required';
    end if;
  else
    v_user_id := public.assert_marketplace_caller();
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'Club name is required';
  end if;

  if nullif(trim(coalesce(p_slug, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'Club slug is required';
  end if;

  v_booking_mode := coalesce(nullif(trim(p_booking_mode), ''), 'manual_request');

  if v_booking_mode not in ('manual_request', 'external_link') then
    raise exception using errcode = 'P0001', message = 'Unsupported booking mode';
  end if;

  if v_booking_mode = 'external_link' then
    v_phone := public.normalize_booking_phone(p_booking_phone);
    if v_phone is null then
      raise exception using errcode = 'P0001', message = 'WhatsApp booking phone is required';
    end if;
  else
    v_phone := case
      when nullif(trim(coalesce(p_booking_phone, '')), '') is null then null
      else public.normalize_booking_phone(p_booking_phone)
    end;
  end if;

  if not v_is_operator and exists (
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
    v_booking_mode,
    coalesce(p_amenities, '{}'::text[]),
    v_is_operator
  );

  if v_phone is not null then
    insert into public.club_private_contacts (club_id, booking_phone)
    values (v_club_id, v_phone)
    on conflict (club_id) do update
    set booking_phone = excluded.booking_phone, updated_at = now();
  end if;

  if not v_is_operator then
    insert into public.club_memberships (club_id, user_id, role, is_active)
    values (v_club_id, v_user_id, 'admin', true);
  end if;

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
    case
      when v_is_operator then 'club_registered_by_operator'
      else 'club_registration_submitted'
    end,
    'club',
    v_club_id,
    jsonb_build_object(
      'slug', lower(trim(p_slug)),
      'booking_mode', v_booking_mode
    )
  );

  return v_club_id;
end;
$$;

revoke all on function public.register_pilot_club(
  text, text, uuid, text, text, numeric, numeric, text[], jsonb, text, text, boolean
) from public, anon;
grant execute on function public.register_pilot_club(
  text, text, uuid, text, text, numeric, numeric, text[], jsonb, text, text, boolean
) to authenticated;
