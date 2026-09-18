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
values
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000011',
    'authenticated',
    'authenticated',
    'milestone-one-a@example.invalid',
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000012',
    'authenticated',
    'authenticated',
    'milestone-one-b@example.invalid',
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000013',
    'authenticated',
    'authenticated',
    'milestone-one-inactive@example.invalid',
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

select pg_temp.assert_true(
  (
    select count(*) = 3
       and bool_and(display_name is null)
    from public.profiles
    where id in (
      '90000000-0000-0000-0000-000000000011',
      '90000000-0000-0000-0000-000000000012',
      '90000000-0000-0000-0000-000000000013'
    )
  ),
  'the auth.users trigger creates blank profiles'
);

update public.profiles
set account_status = 'suspended'
where id = '90000000-0000-0000-0000-000000000013';

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select pg_temp.assert_raises(
  $sql$select * from public.profiles$sql$,
  '42501',
  'anonymous users cannot read profiles'
);
select pg_temp.assert_raises(
  $sql$select public.request_account_deletion()$sql$,
  '42501',
  'anonymous users cannot request deletion'
);
select pg_temp.assert_raises(
  $sql$
    select public.complete_onboarding(
      'Anonymous',
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
    )
  $sql$,
  '42501',
  'anonymous users cannot complete onboarding'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000011',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.profiles
    where id in (
      '90000000-0000-0000-0000-000000000011',
      '90000000-0000-0000-0000-000000000012'
    )
  ),
  'authenticated users can read only their own profile'
);
select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.profiles
    where id = '90000000-0000-0000-0000-000000000012'
  ),
  'authenticated users cannot read another profile'
);

select public.complete_onboarding(
  '  Test   Player A  ',
  1990::smallint,
  true,
  array[' EN ', 'fr', 'en']::text[],
  'intermediate'::public.skill_band,
  'either'::public.play_intent,
  true,
  true,
  array['90000000-0000-0000-0000-000000000001']::uuid[],
  'dev-2026-07-25',
  'dev-2026-07-25',
  'dev-2026-07-25'
);

reset role;

select pg_temp.assert_true(
  (
    select display_name = 'Test Player A'
       and birth_year = 1990
       and is_adult_confirmed
       and languages = array['en', 'fr']::text[]
       and terms_version = 'dev-2026-07-25'
       and privacy_version = 'dev-2026-07-25'
       and community_rules_version = 'dev-2026-07-25'
       and onboarding_completed_at is not null
    from public.profiles
    where id = '90000000-0000-0000-0000-000000000011'
  ),
  'successful onboarding normalizes and stamps the profile'
);
select pg_temp.assert_true(
  (
    select skill_band = 'intermediate'
       and play_intent = 'either'
       and prefers_singles
       and prefers_doubles
       and internal_rating = 1200
       and rated_match_count = 0
    from public.player_profiles
    where user_id = '90000000-0000-0000-0000-000000000011'
  ),
  'successful onboarding creates the tennis profile without client rating input'
);
select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.player_zones
    where user_id = '90000000-0000-0000-0000-000000000011'
      and zone_id = '90000000-0000-0000-0000-000000000001'
      and priority = 1
  ),
  'successful onboarding replaces preferred zones'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000012',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_raises(
  $sql$
    select public.complete_onboarding(
      'Test Player B',
      1990::smallint,
      true,
      array['en']::text[],
      'beginner'::public.skill_band,
      'social'::public.play_intent,
      true,
      false,
      array['90000000-0000-0000-0000-000000000001']::uuid[],
      'stale-version',
      'dev-2026-07-25',
      'dev-2026-07-25'
    )
  $sql$,
  '22023',
  'stale policy versions are rejected'
);

select pg_temp.assert_raises(
  $sql$
    select public.complete_onboarding(
      'Test Player B',
      (extract(year from current_date)::integer - 17)::smallint,
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
    )
  $sql$,
  '22023',
  'underage birth years are rejected'
);

select pg_temp.assert_raises(
  $sql$
    select public.complete_onboarding(
      'Test Player B',
      1990::smallint,
      true,
      array['en']::text[],
      'beginner'::public.skill_band,
      'social'::public.play_intent,
      true,
      false,
      array['90000000-0000-0000-0000-000000000002']::uuid[],
      'dev-2026-07-25',
      'dev-2026-07-25',
      'dev-2026-07-25'
    )
  $sql$,
  '22023',
  'inactive zones are rejected'
);

select pg_temp.assert_raises(
  $sql$
    select public.complete_onboarding(
      'Test Player B',
      1990::smallint,
      true,
      array['en']::text[],
      'beginner'::public.skill_band,
      'social'::public.play_intent,
      true,
      false,
      array['90000000-0000-0000-0000-000000000099']::uuid[],
      'dev-2026-07-25',
      'dev-2026-07-25',
      'dev-2026-07-25'
    )
  $sql$,
  '22023',
  'nonexistent zones are rejected'
);

select pg_temp.assert_raises(
  $sql$
    select public.complete_onboarding(
      'Test Player B',
      1990::smallint,
      true,
      array['en']::text[],
      'beginner'::public.skill_band,
      'social'::public.play_intent,
      false,
      false,
      array['90000000-0000-0000-0000-000000000001']::uuid[],
      'dev-2026-07-25',
      'dev-2026-07-25',
      'dev-2026-07-25'
    )
  $sql$,
  '22023',
  'onboarding without a selected format is rejected'
);

select pg_temp.assert_raises(
  $sql$
    update public.profiles
    set account_status = 'suspended'
    where id = '90000000-0000-0000-0000-000000000012'
  $sql$,
  '42501',
  'clients cannot directly change account status'
);
select pg_temp.assert_raises(
  $sql$
    update public.profiles
    set terms_version = 'forged'
    where id = '90000000-0000-0000-0000-000000000012'
  $sql$,
  '42501',
  'clients cannot directly change policy acceptance'
);
select pg_temp.assert_raises(
  $sql$
    update public.profiles
    set onboarding_completed_at = now()
    where id = '90000000-0000-0000-0000-000000000012'
  $sql$,
  '42501',
  'clients cannot directly stamp onboarding completion'
);
select pg_temp.assert_raises(
  $sql$
    update public.player_profiles
    set internal_rating = 2000
    where user_id = '90000000-0000-0000-0000-000000000011'
  $sql$,
  '42501',
  'clients cannot directly change internal ratings'
);
select pg_temp.assert_raises(
  $sql$select * from public.platform_roles$sql$,
  '42501',
  'role tables remain inaccessible'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000013',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_raises(
  $sql$
    select public.complete_onboarding(
      'Inactive Player',
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
    )
  $sql$,
  '42501',
  'inactive accounts cannot complete onboarding'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000012',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.request_account_deletion();

reset role;

create temporary table deletion_first_result as
select
  account_status,
  (
    select count(*)
    from public.audit_events
    where actor_id = '90000000-0000-0000-0000-000000000012'
      and action = 'account_deleted'
      and entity_type = 'profile'
      and entity_id = '90000000-0000-0000-0000-000000000012'
  ) as audit_count
from public.profiles
where id = '90000000-0000-0000-0000-000000000012';

-- Revised by `102`. This used to assert that requesting deletion twice was
-- idempotent, because the call only set a flag an operator would later act on.
-- No operator tooling was ever built, so the flag was permanent and the account
-- was trapped: unusable, un-restorable, and holding its address hostage.
-- Deletion now completes on the first call, which makes the second one an
-- error rather than a no-op.
select pg_temp.assert_true(
  (
    select first.account_status = 'deleted' and first.audit_count = 1
    from deletion_first_result as first
  ),
  'deletion completes on the first call and writes one audit event'
);

-- The point of the change: the address must be free for a new sign-up.
select pg_temp.assert_true(
  not exists (
    select 1 from auth.users as u
    where u.id = '90000000-0000-0000-0000-000000000012'
      and u.email = 'deletion@example.test'
  ),
  'the address is released when the account is deleted'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000012',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_raises(
  $sql$select public.request_account_deletion()$sql$,
  '42501',
  'an account already deleted cannot be deleted again'
);

reset role;

select pass('Milestone 1 onboarding and authorization matrix passed');
select * from finish();

rollback;
