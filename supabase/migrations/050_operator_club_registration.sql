-- Adding clubs in v1 is an ops job, not a club job.
--
-- register_pilot_club was built for self-service: a club person signs up,
-- registers their own club, becomes its admin, and waits for approval. With the
-- club side deferred out of v1 (docs/DECISIONS.md, 2026-08-03) nobody is on the
-- other end of that flow, so the founder has to enter the clubs. Three things
-- stopped them:
--
-- 1. "You already administer a club" (031:205). Correct for self-service,
--    fatal when one account has to add every pilot club.
-- 2. The caller was always made the club's admin. An operator entering a club
--    on its behalf is not its admin, and pretending otherwise is what triggers
--    the rule above on the second club.
-- 3. booking_mode was hardcoded to manual_request, and the WhatsApp number
--    could only be set afterwards by a club admin -- which, per 2, the operator
--    could not be for more than one club.
--
-- So an operator now registers as many clubs as needed, takes no membership,
-- names the booking mode and number up front, and skips the approval queue
-- because they are the approver. Everything about the self-service path is
-- unchanged and stays ready for when clubs do come aboard.

drop function if exists public.register_pilot_club(
  text, text, uuid, text, text, numeric, numeric, text[], jsonb
);

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
  -- Defaults to the old behaviour so the existing self-service form and its
  -- coverage keep working untouched. The operator form sends external_link.
  p_booking_mode text default 'manual_request',
  p_booking_phone text default null,
  -- Declared rather than inferred from the caller's role. A platform operator
  -- may also register a club of their own, and guessing from the role alone
  -- silently strips them of the admin membership they actually wanted.
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
  -- Requires a fully onboarded, active account rather than any authenticated
  -- session: registration creates operational records and an audit trail.
  v_user_id := public.assert_marketplace_caller();
  v_is_operator := coalesce(p_as_operator, false);

  if v_is_operator and not public.viewer_is_platform_operator() then
    raise exception using errcode = '42501', message = 'Platform operator access required';
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

  -- A WhatsApp club with no number is listed but unbookable: the directory
  -- reports whatsapp_booking_available false and the link RPC refuses.
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

  -- One club per admin keeps a self-service registrant honest. An operator
  -- takes no membership, so the rule has nothing to bite on.
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
    -- SEC-001: pending platform approval; invisible to players until approved.
    -- An operator is the approver, so their own entry skips the queue.
    v_is_operator
  );

  if v_phone is not null then
    insert into public.club_private_contacts (club_id, booking_phone)
    values (v_club_id, v_phone)
    on conflict (club_id) do update
    set booking_phone = excluded.booking_phone, updated_at = now();
  end if;

  -- Only a self-service registrant becomes the club's admin. An operator is
  -- entering someone else's club and should not hold its keys.
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

-- ---------------------------------------------------------------------------
-- Correcting a club's number must not require being its admin
--
-- Copied forward from 017:135. Operators enter these clubs, so they are the
-- ones who fix a mistyped WhatsApp number; the club-admin path is untouched.
-- ---------------------------------------------------------------------------

create or replace function public.update_club_booking_settings(
  p_club_id uuid,
  p_booking_mode text,
  p_booking_phone text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  if not public.viewer_is_platform_operator() then
    perform public.assert_club_admin(p_club_id);
  end if;

  if p_booking_mode not in ('manual_request', 'external_link') then
    raise exception using errcode = 'P0001', message = 'Unsupported booking mode';
  end if;

  if p_booking_mode = 'external_link' then
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

  update public.clubs
  set
    booking_mode = p_booking_mode,
    updated_at = now()
  where id = p_club_id;

  insert into public.club_private_contacts (club_id, booking_phone)
  values (p_club_id, v_phone)
  on conflict (club_id) do update
  set
    booking_phone = excluded.booking_phone,
    updated_at = now();
end;
$$;

revoke all on function public.update_club_booking_settings(uuid, text, text) from public, anon;
grant execute on function public.update_club_booking_settings(uuid, text, text) to authenticated;
