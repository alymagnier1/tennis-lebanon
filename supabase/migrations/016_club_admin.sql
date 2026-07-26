-- Milestone 5.2: pilot club onboarding and club-admin configuration RPCs.

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
    where cm.club_id = p_club_id
      and cm.user_id = p_user_id
      and cm.is_active = true
      and cm.role = 'admin'
  );
$$;

create or replace function public.assert_club_admin(p_club_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not public.is_club_admin(p_club_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Club admin access required';
  end if;

  return v_user_id;
end;
$$;

create or replace function public.list_active_zones()
returns table (
  zone_id uuid,
  slug text,
  name_i18n jsonb,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    z.id,
    z.slug,
    z.name_i18n,
    z.timezone
  from public.zones as z
  where z.is_active = true
  order by z.sort_order, z.slug;
$$;

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
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

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
    true
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

  return v_club_id;
end;
$$;

create or replace function public.get_club_admin_detail(p_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.assert_club_admin(p_club_id);

  select jsonb_build_object(
    'club', jsonb_build_object(
      'club_id', c.id,
      'name', c.name,
      'slug', c.slug,
      'description', c.description,
      'address_public', c.address_public,
      'zone_id', c.zone_id,
      'zone_slug', z.slug,
      'zone_name_i18n', z.name_i18n,
      'latitude', c.latitude,
      'longitude', c.longitude,
      'booking_mode', c.booking_mode,
      'amenities', c.amenities,
      'is_active', c.is_active
    ),
    'courts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'court_id', ct.id,
            'name', ct.name,
            'surface', ct.surface,
            'is_indoor', ct.is_indoor,
            'price_minor', ct.price_minor,
            'currency', ct.currency,
            'slot_minutes', ct.slot_minutes,
            'is_active', ct.is_active,
            'hours', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'hour_id', coh.id,
                    'weekday', coh.weekday,
                    'opens_at', coh.opens_at,
                    'closes_at', coh.closes_at
                  )
                  order by coh.weekday, coh.opens_at
                )
                from public.court_operating_hours as coh
                where coh.court_id = ct.id
                  and coh.valid_from is null
                  and coh.valid_until is null
              ),
              '[]'::jsonb
            )
          )
          order by ct.name
        )
        from public.courts as ct
        where ct.club_id = c.id
          and ct.is_active = true
      ),
      '[]'::jsonb
    ),
    'blocks', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'block_id', cb.id,
            'court_id', cb.court_id,
            'court_name', ct.name,
            'starts_at', cb.starts_at,
            'ends_at', cb.ends_at,
            'reason', cb.reason
          )
          order by cb.starts_at desc
        )
        from public.court_blocks as cb
        join public.courts as ct on ct.id = cb.court_id
        where ct.club_id = c.id
          and cb.ends_at > now()
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.clubs as c
  join public.zones as z on z.id = c.zone_id
  where c.id = p_club_id;

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.update_club_profile(
  p_club_id uuid,
  p_name text,
  p_description text default null,
  p_address_public text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_amenities text[] default '{}'::text[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_club_admin(p_club_id);

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'Club name is required';
  end if;

  update public.clubs
  set
    name = trim(p_name),
    description = nullif(trim(coalesce(p_description, '')), ''),
    address_public = nullif(trim(coalesce(p_address_public, '')), ''),
    latitude = p_latitude,
    longitude = p_longitude,
    amenities = coalesce(p_amenities, '{}'::text[]),
    updated_at = now()
  where id = p_club_id;
end;
$$;

create or replace function public.upsert_club_court(
  p_club_id uuid,
  p_court_id uuid default null,
  p_name text default null,
  p_surface text default 'hard',
  p_is_indoor boolean default false,
  p_price_minor integer default null,
  p_currency char(3) default 'USD',
  p_slot_minutes integer default 90
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_court_id uuid;
  v_weekday integer;
begin
  perform public.assert_club_admin(p_club_id);

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'Court name is required';
  end if;

  if p_slot_minutes < 30 or p_slot_minutes > 240 then
    raise exception using errcode = 'P0001', message = 'Slot minutes must be between 30 and 240';
  end if;

  if p_court_id is null then
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
      p_club_id,
      trim(p_name),
      coalesce(nullif(trim(p_surface), ''), 'hard'),
      coalesce(p_is_indoor, false),
      p_price_minor,
      coalesce(p_currency, 'USD'),
      p_slot_minutes,
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
      values (v_court_id, v_weekday, time '07:00', time '22:00');
    end loop;
  else
    if not exists (
      select 1
      from public.courts as ct
      where ct.id = p_court_id
        and ct.club_id = p_club_id
        and ct.is_active = true
    ) then
      raise exception using errcode = 'P0002', message = 'Court not found';
    end if;

    update public.courts
    set
      name = trim(p_name),
      surface = coalesce(nullif(trim(p_surface), ''), 'hard'),
      is_indoor = coalesce(p_is_indoor, false),
      price_minor = p_price_minor,
      currency = coalesce(p_currency, 'USD'),
      slot_minutes = p_slot_minutes
    where id = p_court_id;

    v_court_id := p_court_id;
  end if;

  return v_court_id;
end;
$$;

create or replace function public.set_court_weekly_hours(
  p_court_id uuid,
  p_hours jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_hour jsonb;
  v_weekday integer;
  v_opens time;
  v_closes time;
begin
  select ct.club_id
  into v_club_id
  from public.courts as ct
  where ct.id = p_court_id
    and ct.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Court not found';
  end if;

  perform public.assert_club_admin(v_club_id);

  delete from public.court_operating_hours as coh
  where coh.court_id = p_court_id
    and coh.valid_from is null
    and coh.valid_until is null;

  for v_hour in
    select value
    from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb))
  loop
    v_weekday := (v_hour->>'weekday')::integer;
    v_opens := (v_hour->>'opens_at')::time;
    v_closes := (v_hour->>'closes_at')::time;

    if v_weekday < 0 or v_weekday > 6 then
      raise exception using errcode = 'P0001', message = 'Weekday must be 0-6';
    end if;

    if v_closes <= v_opens then
      raise exception using errcode = 'P0001', message = 'Close time must be after open time';
    end if;

    insert into public.court_operating_hours (
      court_id,
      weekday,
      opens_at,
      closes_at
    )
    values (p_court_id, v_weekday, v_opens, v_closes);
  end loop;
end;
$$;

create or replace function public.create_court_block(
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_user_id uuid;
  v_block_id uuid;
begin
  select ct.club_id
  into v_club_id
  from public.courts as ct
  where ct.id = p_court_id
    and ct.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Court not found';
  end if;

  v_user_id := public.assert_club_staff(v_club_id);

  if p_ends_at <= p_starts_at then
    raise exception using errcode = 'P0001', message = 'Invalid block time range';
  end if;

  insert into public.court_blocks (
    court_id,
    starts_at,
    ends_at,
    reason,
    created_by
  )
  values (
    p_court_id,
    p_starts_at,
    p_ends_at,
    nullif(trim(coalesce(p_reason, '')), ''),
    v_user_id
  )
  returning id into v_block_id;

  return v_block_id;
end;
$$;

create or replace function public.delete_court_block(p_block_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
begin
  select ct.club_id
  into v_club_id
  from public.court_blocks as cb
  join public.courts as ct on ct.id = cb.court_id
  where cb.id = p_block_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Block not found';
  end if;

  perform public.assert_club_staff(v_club_id);

  delete from public.court_blocks
  where id = p_block_id;
end;
$$;

revoke all on function public.is_club_admin(uuid, uuid) from public, anon;
grant execute on function public.is_club_admin(uuid, uuid) to authenticated;

revoke all on function public.assert_club_admin(uuid) from public, anon;
grant execute on function public.assert_club_admin(uuid) to authenticated;

revoke all on function public.list_active_zones() from public, anon;
grant execute on function public.list_active_zones() to authenticated;

revoke all on function public.register_pilot_club(text, text, uuid, text, text, numeric, numeric, text[], jsonb) from public, anon;
grant execute on function public.register_pilot_club(text, text, uuid, text, text, numeric, numeric, text[], jsonb) to authenticated;

revoke all on function public.get_club_admin_detail(uuid) from public, anon;
grant execute on function public.get_club_admin_detail(uuid) to authenticated;

revoke all on function public.update_club_profile(uuid, text, text, text, numeric, numeric, text[]) from public, anon;
grant execute on function public.update_club_profile(uuid, text, text, text, numeric, numeric, text[]) to authenticated;

revoke all on function public.upsert_club_court(uuid, uuid, text, text, boolean, integer, char(3), integer) from public, anon;
grant execute on function public.upsert_club_court(uuid, uuid, text, text, boolean, integer, char(3), integer) to authenticated;

revoke all on function public.set_court_weekly_hours(uuid, jsonb) from public, anon;
grant execute on function public.set_court_weekly_hours(uuid, jsonb) to authenticated;

revoke all on function public.create_court_block(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.create_court_block(uuid, timestamptz, timestamptz, text) to authenticated;

revoke all on function public.delete_court_block(uuid) from public, anon;
grant execute on function public.delete_court_block(uuid) to authenticated;
