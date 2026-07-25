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

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  exists (
    select 1
    from public.discover_compatible_players(
      p_require_availability_overlap => true,
      p_level_window => 1
    ) as result
    where result.user_id = '22222222-2222-2222-2222-222222222222'
  ),
  'eligible players discover each other with overlapping availability'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.discover_compatible_players(
      p_require_availability_overlap => false,
      p_level_window => 2
    ) as result
    where result.user_id = '66666666-6666-6666-6666-666666666666'
  ),
  'blocked players are excluded from compatible discovery'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.discover_open_matches() as result
    where result.match_id = 'd1111111-1111-1111-1111-111111111111'
  ),
  'eligible public open matches are discoverable'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.discover_open_matches() as result
    where result.match_id in (
      'd4444444-4444-4444-4444-444444444444',
      'd5555555-5555-5555-5555-555555555555',
      'd6666666-6666-6666-6666-666666666666',
      'd7777777-7777-7777-7777-777777777777'
    )
  ),
  'wrong-level, past-time, private, and invite-only matches stay hidden'
);

reset role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-0000-0000-000000000099',
  'authenticated',
  'authenticated',
  'discover-suspended@example.invalid',
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
)
on conflict do nothing;

insert into public.profiles (
  id, display_name, is_adult_confirmed, languages, account_status,
  onboarding_completed_at, terms_version, terms_accepted_at,
  privacy_version, privacy_accepted_at,
  community_rules_version, community_rules_accepted_at
)
values (
  '90000000-0000-0000-0000-000000000099',
  'Suspended Discover',
  true,
  array['en']::text[],
  'suspended',
  now(),
  'seed-v0',
  now(),
  'seed-v0',
  now(),
  'seed-v0',
  now()
)
on conflict (id) do update
set account_status = excluded.account_status;

insert into public.player_profiles (
  user_id, skill_band, play_intent, prefers_singles, prefers_doubles
)
values (
  '90000000-0000-0000-0000-000000000099',
  'intermediate',
  'social',
  true,
  false
)
on conflict (user_id) do nothing;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000099',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_raises(
  $sql$select * from public.discover_compatible_players()$sql$,
  '42501',
  'suspended users cannot call discovery RPCs'
);

reset role;

select pg_temp.assert_raises(
  $sql$
    insert into public.matches (
      creator_id, format, visibility, status, intent,
      min_skill, max_skill
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'singles',
      'public',
      'open',
      'social',
      'competitive',
      'beginner'
    )
  $sql$,
  '23514',
  'invalid skill ranges are rejected by the database constraint'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  (
    select count(*) >= 1
    from public.availability_windows
    where user_id = '11111111-1111-1111-1111-111111111111'
  ),
  'users can read their own availability windows'
);

select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.availability_windows
    where user_id = '22222222-2222-2222-2222-222222222222'
  ),
  'users cannot read another user availability windows'
);

reset role;

select pass('Milestone 2 discovery authorization matrix passed');
select * from finish();

rollback;
