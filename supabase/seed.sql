-- Local development seed data. Runs after migrations on `supabase db reset`.
-- Contains fictional test data only — never use these credentials in production.
--
-- Test accounts (all use password: password):
--   player-a@tennis-lebanon.test
--   player-b@tennis-lebanon.test
--   club-staff@tennis-lebanon.test
--   club-admin@tennis-lebanon.test
--   platform-admin@tennis-lebanon.test
--
-- See docs/PILOT_OPERATIONS.md for roles and workflow rehearsal steps.

-- ---------------------------------------------------------------------------
-- Zones. `beirut` is real geography and is where the real pilot clubs live.
-- The three `pilot-*` rows stay because the seeded demo matches and player
-- preferences below still hang off them; docs/PILOT_OPERATIONS.md lists
-- retiring them as a pre-pilot blocker.
-- ---------------------------------------------------------------------------

insert into public.zones (
  id,
  country_code,
  city_code,
  slug,
  name_i18n,
  timezone,
  is_active,
  sort_order
)
values
  (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'LB',
    'placeholder-corridor',
    'pilot-north',
    '{"en":"Pilot North","ar":"شمال تجريبي","fr":"Nord pilote"}'::jsonb,
    'Asia/Beirut',
    true,
    1
  ),
  (
    'aaaaaaaa-0001-0001-0001-000000000002',
    'LB',
    'placeholder-corridor',
    'pilot-central',
    '{"en":"Pilot Central","ar":"وسط تجريبي","fr":"Centre pilote"}'::jsonb,
    'Asia/Beirut',
    true,
    2
  ),
  (
    'aaaaaaaa-0001-0001-0001-000000000003',
    'LB',
    'placeholder-corridor',
    'pilot-south',
    '{"en":"Pilot South","ar":"جنوب تجريبي","fr":"Sud pilote"}'::jsonb,
    'Asia/Beirut',
    true,
    3
  ),
  -- Sorts first: it is the only zone a real player should be picking today.
  (
    'aaaaaaaa-0001-0001-0001-000000000004',
    'LB',
    'beirut',
    'beirut',
    '{"en":"Beirut","ar":"بيروت","fr":"Beyrouth"}'::jsonb,
    'Asia/Beirut',
    true,
    0
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Placeholder club + court for dashboard/RLS tests (Milestone 5+)
-- ---------------------------------------------------------------------------

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
  'bbbbbbbb-0001-0001-0001-000000000001',
  'aaaaaaaa-0001-0001-0001-000000000002',
  'Pilot Tennis Club',
  'pilot-tennis-club',
  'Placeholder club for local development and RLS tests.',
  'Placeholder address, Beirut area',
  33.893800,
  35.501800,
  'manual_request',
  array['parking', 'showers', 'pay_as_you_play']::text[],
  true
)
on conflict (id) do update
set
  amenities = excluded.amenities,
  description = excluded.description,
  booking_mode = excluded.booking_mode;

insert into public.courts (
  id,
  club_id,
  name,
  surface,
  is_indoor,
  price_minor,
  currency,
  slot_minutes,
  is_active
)
values
  (
    'cccccccc-0001-0001-0001-000000000001',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'Court 1',
    'hard',
    false,
    4000,
    'USD',
    90,
    true
  ),
  (
    'cccccccc-0001-0001-0001-000000000002',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'Court 2',
    'clay',
    false,
    4500,
    'USD',
    90,
    true
  )
on conflict (id) do update
set
  price_minor = excluded.price_minor,
  currency = excluded.currency,
  slot_minutes = excluded.slot_minutes,
  is_active = excluded.is_active;

insert into public.court_operating_hours (
  court_id,
  weekday,
  opens_at,
  closes_at
)
select
  courts.court_id,
  weekdays.weekday,
  time '07:00',
  time '22:00'
from (
  values
    ('cccccccc-0001-0001-0001-000000000001'::uuid),
    ('cccccccc-0001-0001-0001-000000000002'::uuid)
) as courts(court_id)
cross join generate_series(0, 6) as weekdays(weekday)
where not exists (
  select 1
  from public.court_operating_hours as coh
  where coh.court_id = courts.court_id
    and coh.weekday = weekdays.weekday
);

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
  'bbbbbbbb-0001-0001-0001-000000000002',
  'aaaaaaaa-0001-0001-0001-000000000002',
  'WhatsApp Tennis Club',
  'whatsapp-tennis-club',
  'Pilot club that accepts bookings via WhatsApp instead of the in-app queue.',
  'WhatsApp booking demo, Beirut area',
  33.888000,
  35.510000,
  'external_link',
  array['parking', 'pay_as_you_play']::text[],
  true
)
on conflict (id) do update
set
  booking_mode = excluded.booking_mode,
  description = excluded.description;

insert into public.club_private_contacts (club_id, booking_phone)
values (
  'bbbbbbbb-0001-0001-0001-000000000002',
  '+96170123456'
)
on conflict (club_id) do update
set booking_phone = excluded.booking_phone;

insert into public.courts (
  id,
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
  'cccccccc-0001-0001-0001-000000000003',
  'bbbbbbbb-0001-0001-0001-000000000002',
  'Court 1',
  'hard',
  false,
  3500,
  'USD',
  90,
  true
)
on conflict (id) do update
set
  price_minor = excluded.price_minor,
  currency = excluded.currency,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Real pilot clubs (Beirut)
--
-- These are actual venues, not fixtures. They live here rather than being
-- typed into the dashboard because `supabase db reset` drops the whole
-- database and replays this file -- anything entered by hand is erased and
-- only what is written here comes back.
--
-- Every field below that could mislead a real player is deliberately left
-- unset rather than guessed:
--   booking_phone  placeholder digits, NOT reachable numbers
--   price_minor    null -- a wrong price is a player turning up to a surprise
--   address/coords null -- a wrong pin sends someone to the wrong street
--
-- TODO(founder): replace the placeholder WhatsApp numbers with each club's
-- real booking number, and fill in address, coordinates and court prices,
-- before these clubs are shown to anyone outside the team. Until then the
-- "Book on WhatsApp" button will not reach the club.
-- ---------------------------------------------------------------------------

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
values
  (
    'bbbbbbbb-0001-0001-0001-000000000003',
    'aaaaaaaa-0001-0001-0001-000000000004',
    'Riyadi',
    'riyadi',
    null,
    null,
    null,
    null,
    'external_link',
    '{}'::text[],
    true
  ),
  (
    'bbbbbbbb-0001-0001-0001-000000000004',
    'aaaaaaaa-0001-0001-0001-000000000004',
    'Movenpick',
    'movenpick',
    null,
    null,
    null,
    null,
    'external_link',
    '{}'::text[],
    true
  ),
  (
    'bbbbbbbb-0001-0001-0001-000000000005',
    'aaaaaaaa-0001-0001-0001-000000000004',
    'Hoops',
    'hoops',
    null,
    null,
    null,
    null,
    'external_link',
    '{}'::text[],
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  zone_id = excluded.zone_id,
  booking_mode = excluded.booking_mode,
  is_active = excluded.is_active;

-- Placeholder numbers. See the TODO above -- these do not reach the clubs.
insert into public.club_private_contacts (club_id, booking_phone)
values
  ('bbbbbbbb-0001-0001-0001-000000000003', '+96170000001'),
  ('bbbbbbbb-0001-0001-0001-000000000004', '+96170000002'),
  ('bbbbbbbb-0001-0001-0001-000000000005', '+96170000003')
on conflict (club_id) do update
set booking_phone = excluded.booking_phone;

-- One court each: register_pilot_club requires at least one, and a club with
-- no court cannot be picked as a match venue.
insert into public.courts (
  id,
  club_id,
  name,
  surface,
  is_indoor,
  price_minor,
  currency,
  slot_minutes,
  is_active
)
values
  (
    'cccccccc-0001-0001-0001-000000000004',
    'bbbbbbbb-0001-0001-0001-000000000003',
    'Court 1',
    'hard',
    false,
    null,
    'USD',
    90,
    true
  ),
  (
    'cccccccc-0001-0001-0001-000000000005',
    'bbbbbbbb-0001-0001-0001-000000000004',
    'Court 1',
    'hard',
    false,
    null,
    'USD',
    90,
    true
  ),
  (
    'cccccccc-0001-0001-0001-000000000006',
    'bbbbbbbb-0001-0001-0001-000000000005',
    'Court 1',
    'hard',
    false,
    null,
    'USD',
    90,
    true
  )
on conflict (id) do update
set
  club_id = excluded.club_id,
  slot_minutes = excluded.slot_minutes,
  is_active = excluded.is_active;

insert into public.court_operating_hours (
  court_id,
  weekday,
  opens_at,
  closes_at
)
select
  courts.court_id,
  weekdays.weekday,
  time '07:00',
  time '22:00'
from (
  values
    ('cccccccc-0001-0001-0001-000000000004'::uuid),
    ('cccccccc-0001-0001-0001-000000000005'::uuid),
    ('cccccccc-0001-0001-0001-000000000006'::uuid)
) as courts(court_id)
cross join generate_series(0, 6) as weekdays(weekday)
where not exists (
  select 1
  from public.court_operating_hours as coh
  where coh.court_id = courts.court_id
    and coh.weekday = weekdays.weekday
);

-- ---------------------------------------------------------------------------
-- Auth test users (local Supabase only)
-- ---------------------------------------------------------------------------

do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_password text := crypt('password', gen_salt('bf'));
begin
  -- Player A
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    v_instance_id,
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'player-a@tennis-lebanon.test', v_password,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  ) on conflict do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'player-a@tennis-lebanon.test',
    jsonb_build_object(
      'sub', '11111111-1111-1111-1111-111111111111',
      'email', 'player-a@tennis-lebanon.test'
    ),
    'email', now(), now(), now()
  ) on conflict do nothing;

  -- Player B
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    v_instance_id,
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'player-b@tennis-lebanon.test', v_password,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  ) on conflict do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'player-b@tennis-lebanon.test',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222222',
      'email', 'player-b@tennis-lebanon.test'
    ),
    'email', now(), now(), now()
  ) on conflict do nothing;

  -- Club staff
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    v_instance_id,
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated',
    'club-staff@tennis-lebanon.test', v_password,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  ) on conflict do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    '33333333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333',
    'club-staff@tennis-lebanon.test',
    jsonb_build_object(
      'sub', '33333333-3333-3333-3333-333333333333',
      'email', 'club-staff@tennis-lebanon.test'
    ),
    'email', now(), now(), now()
  ) on conflict do nothing;

  -- Club admin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    v_instance_id,
    '44444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated',
    'club-admin@tennis-lebanon.test', v_password,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  ) on conflict do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    '44444444-4444-4444-4444-444444444444',
    '44444444-4444-4444-4444-444444444444',
    'club-admin@tennis-lebanon.test',
    jsonb_build_object(
      'sub', '44444444-4444-4444-4444-444444444444',
      'email', 'club-admin@tennis-lebanon.test'
    ),
    'email', now(), now(), now()
  ) on conflict do nothing;

  -- Platform admin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    v_instance_id,
    '55555555-5555-5555-5555-555555555555',
    'authenticated', 'authenticated',
    'platform-admin@tennis-lebanon.test', v_password,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  ) on conflict do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    '55555555-5555-5555-5555-555555555555',
    '55555555-5555-5555-5555-555555555555',
    'platform-admin@tennis-lebanon.test',
    jsonb_build_object(
      'sub', '55555555-5555-5555-5555-555555555555',
      'email', 'platform-admin@tennis-lebanon.test'
    ),
    'email', now(), now(), now()
  ) on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles and roles
-- ---------------------------------------------------------------------------

insert into public.profiles (
  id, display_name, is_adult_confirmed, languages, account_status,
  onboarding_completed_at, terms_version, terms_accepted_at,
  privacy_version, privacy_accepted_at,
  community_rules_version, community_rules_accepted_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Player A', true, array['en']::text[], 'active',
    now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Player B', true, array['en']::text[], 'active',
    now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Club Staff', true, array['en']::text[], 'active',
    now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Club Admin', true, array['en']::text[], 'active',
    now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'Platform Admin', true, array['en']::text[], 'active',
    now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()
  )
on conflict (id) do update
set
  display_name = excluded.display_name,
  is_adult_confirmed = excluded.is_adult_confirmed,
  languages = excluded.languages,
  account_status = excluded.account_status,
  onboarding_completed_at = excluded.onboarding_completed_at,
  terms_version = excluded.terms_version,
  terms_accepted_at = excluded.terms_accepted_at,
  privacy_version = excluded.privacy_version,
  privacy_accepted_at = excluded.privacy_accepted_at,
  community_rules_version = excluded.community_rules_version,
  community_rules_accepted_at = excluded.community_rules_accepted_at;

insert into public.player_profiles (
  user_id, skill_band, play_intent, prefers_singles, prefers_doubles
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'intermediate', 'either', true, true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'improving', 'social', true, false
  )
on conflict (user_id) do nothing;

insert into public.player_zones (user_id, zone_id, priority)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0001-0001-0001-000000000001', 1),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0001-0001-0001-000000000002', 2),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0001-0001-0001-000000000002', 1)
on conflict do nothing;

insert into public.club_memberships (club_id, user_id, role, is_active)
values
  (
    'bbbbbbbb-0001-0001-0001-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'staff',
    true
  ),
  (
    'bbbbbbbb-0001-0001-0001-000000000001',
    '44444444-4444-4444-4444-444444444444',
    'admin',
    true
  )
on conflict do nothing;

insert into public.platform_roles (user_id, role)
values ('55555555-5555-5555-5555-555555555555', 'admin')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Milestone 2 discovery fixtures
-- ---------------------------------------------------------------------------

do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_password text := crypt('password', gen_salt('bf'));
  v_player record;
begin
  for v_player in
    select *
    from (
      values
        ('66666666-6666-6666-6666-666666666666'::uuid, 'player-c@tennis-lebanon.test'),
        ('77777777-7777-7777-7777-777777777777'::uuid, 'player-d@tennis-lebanon.test'),
        ('88888888-8888-8888-8888-888888888888'::uuid, 'player-e@tennis-lebanon.test'),
        ('99999999-9999-9999-9999-999999999999'::uuid, 'player-f@tennis-lebanon.test'),
        ('10101010-1010-1010-1010-101010101010'::uuid, 'player-g@tennis-lebanon.test'),
        ('12121212-1212-1212-1212-121212121212'::uuid, 'player-h@tennis-lebanon.test'),
        ('13131313-1313-1313-1313-131313131313'::uuid, 'player-i@tennis-lebanon.test'),
        ('14141414-1414-1414-1414-141414141414'::uuid, 'player-j@tennis-lebanon.test')
    ) as players(id, email)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      v_instance_id, v_player.id, 'authenticated', 'authenticated',
      v_player.email, v_password, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb, now(), now(), '', '', '', ''
    ) on conflict do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_player.id, v_player.id, v_player.email,
      jsonb_build_object('sub', v_player.id::text, 'email', v_player.email),
      'email', now(), now(), now()
    ) on conflict do nothing;
  end loop;
end $$;

insert into public.profiles (
  id, display_name, is_adult_confirmed, languages, account_status,
  onboarding_completed_at, terms_version, terms_accepted_at,
  privacy_version, privacy_accepted_at,
  community_rules_version, community_rules_accepted_at
)
values
  ('66666666-6666-6666-6666-666666666666', 'Player C', true, array['en']::text[], 'active', now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()),
  ('77777777-7777-7777-7777-777777777777', 'Player D', true, array['en']::text[], 'active', now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()),
  ('88888888-8888-8888-8888-888888888888', 'Player E', true, array['en']::text[], 'active', now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()),
  ('99999999-9999-9999-9999-999999999999', 'Player F', true, array['en']::text[], 'active', now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()),
  ('10101010-1010-1010-1010-101010101010', 'Player G', true, array['en']::text[], 'active', now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()),
  ('12121212-1212-1212-1212-121212121212', 'Player H', true, array['en']::text[], 'active', now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()),
  ('13131313-1313-1313-1313-131313131313', 'Player I', true, array['en']::text[], 'active', now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now()),
  ('14141414-1414-1414-1414-141414141414', 'Player J', true, array['en']::text[], 'active', now(), 'seed-v0', now(), 'seed-v0', now(), 'seed-v0', now())
on conflict (id) do update
set display_name = excluded.display_name,
    account_status = excluded.account_status,
    onboarding_completed_at = excluded.onboarding_completed_at,
    is_adult_confirmed = excluded.is_adult_confirmed,
    terms_version = excluded.terms_version,
    terms_accepted_at = excluded.terms_accepted_at,
    privacy_version = excluded.privacy_version,
    privacy_accepted_at = excluded.privacy_accepted_at,
    community_rules_version = excluded.community_rules_version,
    community_rules_accepted_at = excluded.community_rules_accepted_at;

insert into public.player_profiles (
  user_id, skill_band, play_intent, prefers_singles, prefers_doubles
)
values
  ('66666666-6666-6666-6666-666666666666', 'intermediate', 'social', true, true),
  ('77777777-7777-7777-7777-777777777777', 'advanced', 'competitive', true, false),
  ('88888888-8888-8888-8888-888888888888', 'improving', 'either', true, true),
  ('99999999-9999-9999-9999-999999999999', 'beginner', 'social', true, false),
  ('10101010-1010-1010-1010-101010101010', 'competitive', 'competitive', true, true),
  ('12121212-1212-1212-1212-121212121212', 'intermediate', 'either', false, true),
  ('13131313-1313-1313-1313-131313131313', 'advanced', 'social', true, true),
  ('14141414-1414-1414-1414-141414141414', 'improving', 'social', true, false)
on conflict (user_id) do nothing;

insert into public.player_zones (user_id, zone_id, priority)
values
  ('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-0001-0001-0001-000000000002', 1),
  ('77777777-7777-7777-7777-777777777777', 'aaaaaaaa-0001-0001-0001-000000000001', 1),
  ('88888888-8888-8888-8888-888888888888', 'aaaaaaaa-0001-0001-0001-000000000002', 1),
  ('99999999-9999-9999-9999-999999999999', 'aaaaaaaa-0001-0001-0001-000000000003', 1),
  ('10101010-1010-1010-1010-101010101010', 'aaaaaaaa-0001-0001-0001-000000000002', 1),
  ('12121212-1212-1212-1212-121212121212', 'aaaaaaaa-0001-0001-0001-000000000001', 1),
  ('13131313-1313-1313-1313-131313131313', 'aaaaaaaa-0001-0001-0001-000000000003', 1),
  ('14141414-1414-1414-1414-141414141414', 'aaaaaaaa-0001-0001-0001-000000000002', 1)
on conflict do nothing;

insert into public.user_blocks (blocker_id, blocked_id)
values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666')
on conflict do nothing;

insert into public.availability_windows (
  user_id, weekday, local_start, local_end, timezone, is_recurring
)
select player_id, 5, time '18:00', time '21:00', 'Asia/Beirut', true
from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid),
    ('22222222-2222-2222-2222-222222222222'::uuid),
    ('77777777-7777-7777-7777-777777777777'::uuid),
    ('88888888-8888-8888-8888-888888888888'::uuid),
    ('10101010-1010-1010-1010-101010101010'::uuid),
    ('14141414-1414-1414-1414-141414141414'::uuid)
) as players(player_id)
on conflict do nothing;

insert into public.availability_windows (
  user_id, weekday, local_start, local_end, timezone, is_recurring
)
select player_id, 6, time '09:00', time '12:00', 'Asia/Beirut', true
from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid),
    ('22222222-2222-2222-2222-222222222222'::uuid),
    ('99999999-9999-9999-9999-999999999999'::uuid),
    ('12121212-1212-1212-1212-121212121212'::uuid)
) as players(player_id)
on conflict do nothing;

insert into public.availability_windows (
  user_id, weekday, local_start, local_end, timezone, is_recurring
)
select
  player_id,
  weekday,
  time '17:00',
  time '22:00',
  'Asia/Beirut',
  true
from (
  values
    ('77777777-7777-7777-7777-777777777777'::uuid),
    ('88888888-8888-8888-8888-888888888888'::uuid),
    ('99999999-9999-9999-9999-999999999999'::uuid),
    ('10101010-1010-1010-1010-101010101010'::uuid),
    ('12121212-1212-1212-1212-121212121212'::uuid),
    ('13131313-1313-1313-1313-131313131313'::uuid),
    ('14141414-1414-1414-1414-141414141414'::uuid)
) as players(player_id)
cross join (
  values (0::smallint), (1::smallint), (2::smallint)
) as weekdays(weekday)
where not exists (
  select 1
  from public.availability_windows as aw
  where aw.user_id = players.player_id
    and aw.weekday = weekdays.weekday
    and aw.local_start = time '17:00'
    and aw.local_end = time '22:00'
    and aw.is_recurring = true
);

insert into public.matches (
  id, creator_id, format, visibility, status, intent,
  min_skill, max_skill, requires_creator_approval
)
values
  ('d1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'singles', 'public', 'open', 'social', 'improving', 'intermediate', false),
  ('d2222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', 'doubles', 'public', 'open', 'either', 'intermediate', 'advanced', false),
  ('d3333333-3333-3333-3333-333333333333', '10101010-1010-1010-1010-101010101010', 'singles', 'public', 'open', 'competitive', 'advanced', 'competitive', false),
  ('d4444444-4444-4444-4444-444444444444', '13131313-1313-1313-1313-131313131313', 'singles', 'public', 'open', 'competitive', 'advanced', 'competitive', false),
  ('d5555555-5555-5555-5555-555555555555', '88888888-8888-8888-8888-888888888888', 'singles', 'public', 'open', 'social', 'beginner', 'improving', false),
  ('d6666666-6666-6666-6666-666666666666', '14141414-1414-1414-1414-141414141414', 'singles', 'private', 'open', 'social', 'improving', 'intermediate', false),
  ('d7777777-7777-7777-7777-777777777777', '12121212-1212-1212-1212-121212121212', 'doubles', 'invite_only', 'open', 'either', 'intermediate', 'advanced', false),
  ('d8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', 'singles', 'public', 'open', 'social', 'improving', 'intermediate', false),
  ('d9999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'singles', 'public', 'open', 'social', 'improving', 'intermediate', true)
on conflict (id) do nothing;

insert into public.match_zones (match_id, zone_id)
values
  ('d1111111-1111-1111-1111-111111111111', 'aaaaaaaa-0001-0001-0001-000000000002'),
  ('d2222222-2222-2222-2222-222222222222', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('d3333333-3333-3333-3333-333333333333', 'aaaaaaaa-0001-0001-0001-000000000002'),
  ('d4444444-4444-4444-4444-444444444444', 'aaaaaaaa-0001-0001-0001-000000000002'),
  ('d5555555-5555-5555-5555-555555555555', 'aaaaaaaa-0001-0001-0001-000000000002'),
  ('d6666666-6666-6666-6666-666666666666', 'aaaaaaaa-0001-0001-0001-000000000002'),
  ('d7777777-7777-7777-7777-777777777777', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('d8888888-8888-8888-8888-888888888888', 'aaaaaaaa-0001-0001-0001-000000000002'),
  ('d9999999-9999-9999-9999-999999999999', 'aaaaaaaa-0001-0001-0001-000000000002')
on conflict do nothing;

insert into public.match_participants (match_id, user_id, status, is_creator)
values
  ('d1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted', true),
  ('d2222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', 'accepted', true),
  ('d3333333-3333-3333-3333-333333333333', '10101010-1010-1010-1010-101010101010', 'accepted', true),
  ('d3333333-3333-3333-3333-333333333333', '13131313-1313-1313-1313-131313131313', 'accepted', true),
  ('d4444444-4444-4444-4444-444444444444', '13131313-1313-1313-1313-131313131313', 'accepted', true),
  ('d5555555-5555-5555-5555-555555555555', '88888888-8888-8888-8888-888888888888', 'accepted', true),
  ('d6666666-6666-6666-6666-666666666666', '14141414-1414-1414-1414-141414141414', 'accepted', true),
  ('d7777777-7777-7777-7777-777777777777', '12121212-1212-1212-1212-121212121212', 'accepted', true),
  ('d8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', 'accepted', true),
  ('d8888888-8888-8888-8888-888888888888', '14141414-1414-1414-1414-141414141414', 'accepted', false),
  ('d9999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'accepted', true)
on conflict do nothing;

insert into public.match_time_options (id, match_id, starts_at, ends_at, proposed_by)
values
  ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', now() + interval '2 days', now() + interval '2 days 90 minutes', '22222222-2222-2222-2222-222222222222'),
  ('e2222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', now() + interval '3 days', now() + interval '3 days 90 minutes', '77777777-7777-7777-7777-777777777777'),
  ('e3333333-3333-3333-3333-333333333333', 'd3333333-3333-3333-3333-333333333333', now() + interval '4 days', now() + interval '4 days 90 minutes', '10101010-1010-1010-1010-101010101010'),
  ('e4444444-4444-4444-4444-444444444444', 'd4444444-4444-4444-4444-444444444444', now() + interval '5 days', now() + interval '5 days 90 minutes', '13131313-1313-1313-1313-131313131313'),
  ('e5555555-5555-5555-5555-555555555555', 'd5555555-5555-5555-5555-555555555555', now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', '88888888-8888-8888-8888-888888888888'),
  ('e6666666-6666-6666-6666-666666666666', 'd6666666-6666-6666-6666-666666666666', now() + interval '6 days', now() + interval '6 days 90 minutes', '14141414-1414-1414-1414-141414141414'),
  ('e7777777-7777-7777-7777-777777777777', 'd7777777-7777-7777-7777-777777777777', now() + interval '7 days', now() + interval '7 days 90 minutes', '12121212-1212-1212-1212-121212121212'),
  ('e8888888-8888-8888-8888-888888888888', 'd8888888-8888-8888-8888-888888888888', now() + interval '8 days', now() + interval '8 days 90 minutes', '88888888-8888-8888-8888-888888888888'),
  ('e9999999-9999-9999-9999-999999999999', 'd9999999-9999-9999-9999-999999999999', now() + interval '9 days', now() + interval '9 days 90 minutes', '11111111-1111-1111-1111-111111111111')
on conflict do nothing;
