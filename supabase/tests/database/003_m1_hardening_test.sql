\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

create or replace function pg_temp.assert_true(
  p_condition boolean,
  p_message text
)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create or replace function pg_temp.assert_raises(
  p_sql text,
  p_expected_state text,
  p_message text
)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      if sqlstate = p_expected_state then
        return;
      end if;

      raise exception
        'assertion failed: % (expected SQLSTATE %, got %: %)',
        p_message,
        p_expected_state,
        sqlstate,
        sqlerrm;
  end;

  raise exception
    'assertion failed: % (expected SQLSTATE %, but statement succeeded)',
    p_message,
    p_expected_state;
end;
$$;

insert into public.zones (
  id,
  country_code,
  city_code,
  slug,
  name_i18n,
  is_active
)
values
  (
    '90000000-0000-0000-0000-000000000001',
    'LB',
    'test-city',
    'test-active',
    '{"en":"Test Active"}'::jsonb,
    true
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    'LB',
    'test-city',
    'test-inactive',
    '{"en":"Test Inactive"}'::jsonb,
    false
  );

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-0000-0000-000000000021',
  'authenticated',
  'authenticated',
  'milestone-one-hardening@example.invalid',
  crypt('test-only-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000021',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.complete_onboarding(
  'Hardening Player',
  1990::smallint,
  true,
  array['en']::text[],
  'beginner'::public.skill_band,
  'social'::public.play_intent,
  true,
  false,
  array['90000000-0000-0000-0000-000000000001']::uuid[],
  'dev-2026-07-25',
  'dev-2026-07-25',
  'dev-2026-07-25'
);

select pg_temp.assert_raises(
  $sql$
    update public.player_profiles
    set skill_band = 'competitive'
    where user_id = '90000000-0000-0000-0000-000000000021'
  $sql$,
  '42501',
  'clients cannot directly change skill band after onboarding'
);

select pg_temp.assert_raises(
  $sql$
    insert into public.player_zones (user_id, zone_id, priority)
    values (
      '90000000-0000-0000-0000-000000000021',
      '90000000-0000-0000-0000-000000000002',
      2
    )
  $sql$,
  '22023',
  'direct player zone inserts reject inactive zones'
);

select pg_temp.assert_raises(
  $sql$select * from public.bookings$sql$,
  '42501',
  'bookings remain inaccessible without explicit policies'
);
select pg_temp.assert_raises(
  $sql$select * from public.match_messages$sql$,
  '42501',
  'match messages remain inaccessible without explicit policies'
);
select pg_temp.assert_raises(
  $sql$select * from public.notifications$sql$,
  '42501',
  'notifications remain inaccessible without explicit policies'
);
select pg_temp.assert_raises(
  $sql$select * from public.club_private_contacts$sql$,
  '42501',
  'club private contacts remain inaccessible without explicit policies'
);

reset role;

select pass('Milestone 1 hardening authorization matrix passed');
select * from finish();

rollback;
