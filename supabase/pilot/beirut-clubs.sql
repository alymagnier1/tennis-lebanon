-- Four Beirut venues for STAGING. Not a migration, and not seed.
--
-- Phones are required and are the clubs' **public** WhatsApp numbers only.
-- Never a personal mobile. Do not commit real numbers in git unless they are
-- already published by the club.
--
--   psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 ^
--     -v renaissance_wa="+961XXXXXXXX" ^
--     -v riyadi_wa="+961XXXXXXXX" ^
--     -v jdk_wa="+961XXXXXXXX" ^
--     -v private_wa="+961XXXXXXXX" ^
--     -f supabase/pilot/beirut-clubs.sql
--
-- Idempotent on club slug. Dashboard /onboarding is the other path (needs
-- migration 097 so an un-onboarded operator can call the RPC).

\if :{?renaissance_wa}
\else
\echo 'Set :renaissance_wa :riyadi_wa :jdk_wa :private_wa to public WhatsApp numbers, then re-run.'
\quit 1
\endif
\if :{?riyadi_wa}
\else
\echo 'Set :riyadi_wa (and the other three) to public WhatsApp numbers, then re-run.'
\quit 1
\endif
\if :{?jdk_wa}
\else
\echo 'Set :jdk_wa (and the other three) to public WhatsApp numbers, then re-run.'
\quit 1
\endif
\if :{?private_wa}
\else
\echo 'Set :private_wa (and the other three) to public WhatsApp numbers, then re-run.'
\quit 1
\endif

create temporary table if not exists pg_temp.pilot_venues (
  name text not null,
  slug text not null,
  address text not null,
  phone text not null
);

truncate pg_temp.pilot_venues;

insert into pg_temp.pilot_venues (name, slug, address, phone)
values
  ('Renaissance Tennis Club', 'renaissance-tennis-club', 'Manara, Beirut', :'renaissance_wa'),
  ('Al Riyadi Beirut Club', 'al-riyadi-beirut', 'Manara, Beirut', :'riyadi_wa'),
  ('JDK Sports Club', 'jdk-sports-club', 'Manara, Beirut', :'jdk_wa'),
  ('The Private Club', 'the-private-club', 'Dekwaneh, Beirut', :'private_wa');

do $pilot$
declare
  v_zone uuid;
  v_club uuid;
  v_court uuid;
  v_weekday integer;
  v_phone text;
  r record;
begin
  select z.id into v_zone
  from public.zones as z
  where z.city_code = 'beirut' and z.slug = 'beirut' and z.is_active
  limit 1;

  if v_zone is null then
    raise exception 'Beirut zone missing — run supabase/pilot/beirut-zones.sql first';
  end if;

  for r in
    select name, slug, address, phone from pg_temp.pilot_venues
  loop
    v_phone := public.normalize_booking_phone(r.phone);
    if v_phone is null then
      raise exception 'Invalid WhatsApp number for %', r.name;
    end if;

    insert into public.clubs (
      zone_id,
      name,
      slug,
      address_public,
      booking_mode,
      amenities,
      is_active
    )
    values (
      v_zone,
      r.name,
      r.slug,
      r.address,
      'external_link',
      array['parking']::text[],
      true
    )
    on conflict (slug) do update
    set
      name = excluded.name,
      address_public = excluded.address_public,
      booking_mode = 'external_link',
      is_active = true,
      updated_at = now()
    returning id into v_club;

    insert into public.club_private_contacts (club_id, booking_phone)
    values (v_club, v_phone)
    on conflict (club_id) do update
    set booking_phone = excluded.booking_phone, updated_at = now();

    insert into public.courts (
      club_id,
      name,
      surface,
      is_indoor,
      slot_minutes,
      is_active
    )
    values (v_club, 'Court 1', 'hard', false, 90, true)
    on conflict (club_id, name) do update
    set is_active = true
    returning id into v_court;

    if not exists (
      select 1 from public.court_operating_hours as h where h.court_id = v_court
    ) then
      for v_weekday in 0..6 loop
        insert into public.court_operating_hours (
          court_id,
          weekday,
          opens_at,
          closes_at
        )
        values (v_court, v_weekday, time '07:00', time '22:00');
      end loop;
    end if;
  end loop;
end;
$pilot$;

select c.slug, c.name, c.booking_mode, c.is_active
from public.clubs as c
order by c.slug;
