-- Milestone 5.3: optional WhatsApp booking mode for clubs (external_link).

create or replace function public.normalize_booking_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text;
begin
  if nullif(trim(coalesce(p_phone, '')), '') is null then
    return null;
  end if;

  v_digits := regexp_replace(trim(p_phone), '[^0-9]', '', 'g');

  if length(v_digits) < 8 then
    raise exception using errcode = 'P0001', message = 'Booking phone number is too short';
  end if;

  if v_digits ~ '^0' then
    v_digits := '961' || substring(v_digits from 2);
  elsif v_digits !~ '^961' and length(v_digits) <= 10 then
    v_digits := '961' || v_digits;
  end if;

  return v_digits;
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
      'booking_phone', cpc.booking_phone,
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
  left join public.club_private_contacts as cpc on cpc.club_id = c.id
  where c.id = p_club_id;

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  return v_result;
end;
$$;

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
  perform public.assert_club_admin(p_club_id);

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

create or replace function public.get_club_detail(p_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id := public.assert_discovery_caller_eligible();

  select jsonb_build_object(
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
    'whatsapp_booking_available', (
      c.booking_mode = 'external_link'
      and nullif(trim(coalesce(cpc.booking_phone, '')), '') is not null
    ),
    'amenities', c.amenities,
    'is_favorite', exists (
      select 1
      from public.player_favorite_clubs as pfc
      where pfc.user_id = v_user_id
        and pfc.club_id = c.id
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
            'slot_minutes', ct.slot_minutes
          )
          order by ct.name
        )
        from public.courts as ct
        where ct.club_id = c.id
          and ct.is_active = true
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.clubs as c
  join public.zones as z on z.id = c.zone_id
  left join public.club_private_contacts as cpc on cpc.club_id = c.id
  where c.id = p_club_id
    and c.is_active = true;

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.get_club_whatsapp_booking_link(
  p_club_id uuid,
  p_match_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_club public.clubs%rowtype;
  v_phone text;
  v_message text;
  v_match public.matches%rowtype;
  v_time public.match_time_options%rowtype;
  v_participant_count integer;
begin
  v_user_id := public.assert_discovery_caller_eligible();

  select *
  into v_club
  from public.clubs as c
  where c.id = p_club_id
    and c.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if v_club.booking_mode <> 'external_link' then
    raise exception using errcode = 'P0001', message = 'Club does not offer WhatsApp booking';
  end if;

  select public.normalize_booking_phone(cpc.booking_phone)
  into v_phone
  from public.club_private_contacts as cpc
  where cpc.club_id = p_club_id;

  if v_phone is null then
    raise exception using errcode = 'P0001', message = 'Club WhatsApp booking is not configured';
  end if;

  v_message := format(
    'Hello, I would like to book a court at %s through Tennis Lebanon.',
    v_club.name
  );

  if p_match_id is not null then
    select *
    into v_match
    from public.matches as m
    where m.id = p_match_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'Match not found';
    end if;

    if not exists (
      select 1
      from public.match_participants as mp
      where mp.match_id = p_match_id
        and mp.user_id = v_user_id
        and mp.status = 'accepted'
    ) then
      raise exception using errcode = '42501', message = 'Match participant access required';
    end if;

    select count(*)::integer
    into v_participant_count
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'accepted';

    if v_match.selected_time_option_id is not null then
      select *
      into v_time
      from public.match_time_options as mto
      where mto.id = v_match.selected_time_option_id;
    end if;

    v_message := format(
      'Hello, I would like to book a court at %s through Tennis Lebanon.%sFormat: %s%sPlayers: %s',
      v_club.name,
      E'\n',
      v_match.format,
      case
        when v_time.id is not null then
          format(
            E'\nPreferred time (UTC): %s to %s',
            to_char(v_time.starts_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI'),
            to_char(v_time.ends_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
          )
        else ''
      end,
      coalesce(v_participant_count::text, '?')
    );
  end if;

  return jsonb_build_object(
    'club_id', v_club.id,
    'club_name', v_club.name,
    'phone_digits', v_phone,
    'message', v_message
  );
end;
$$;

revoke all on function public.normalize_booking_phone(text) from public, anon, authenticated;
grant execute on function public.normalize_booking_phone(text) to authenticated;

revoke all on function public.update_club_booking_settings(uuid, text, text) from public, anon;
grant execute on function public.update_club_booking_settings(uuid, text, text) to authenticated;

revoke all on function public.get_club_whatsapp_booking_link(uuid, uuid) from public, anon;
grant execute on function public.get_club_whatsapp_booking_link(uuid, uuid) to authenticated;
