-- Local development seed data. Runs after migrations on `supabase db reset`.
-- Contains fictional test data only — never use these credentials in production.
--
-- Test accounts (all use password: dev-password-change-me):
--   player-a@tennis-lebanon.test
--   player-b@tennis-lebanon.test
--   club-staff@tennis-lebanon.test
--   club-admin@tennis-lebanon.test
--   platform-admin@tennis-lebanon.test

-- ---------------------------------------------------------------------------
-- Pilot placeholder zones (replace with real geography before public pilot)
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
  true
)
on conflict do nothing;

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
  'cccccccc-0001-0001-0001-000000000001',
  'bbbbbbbb-0001-0001-0001-000000000001',
  'Court 1',
  'hard',
  false,
  4000,
  'USD',
  60,
  true
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Auth test users (local Supabase only)
-- ---------------------------------------------------------------------------

do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_password text := crypt('dev-password-change-me', gen_salt('bf'));
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
