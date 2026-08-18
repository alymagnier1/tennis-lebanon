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

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

create or replace function pg_temp.create_test_match(
  p_creator_id uuid,
  p_format public.match_format default 'singles',
  p_visibility public.match_visibility default 'public',
  p_requires_creator_approval boolean default false
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_existing_id uuid;
begin
  perform pg_temp.set_caller(p_creator_id);

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = p_format
      and lm.status in ('open', 'full', 'ready_to_book')
  loop
    perform public.cancel_match(v_existing_id, 'test cleanup');
  end loop;

  select public.create_and_publish_match(
    p_format,
    p_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    p_requires_creator_approval,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      )
    ),
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  )
  into v_match_id;

  return v_match_id;
end;
$$;

-- An open singles match this file owns outright. It used to join the seeded
-- d1111111, which any manual use of a dev database can cancel or fill -- and a
-- cancelled fixture makes this fail with match_not_joinable, which says nothing
-- about joining. The shape mirrors the seed's so the eligibility rules exercised
-- here are unchanged.
insert into public.matches (
  id, creator_id, format, visibility, status, intent,
  min_skill, max_skill, requires_creator_approval
)
values (
  'd0000007-0000-0000-0000-000000000007',
  '22222222-2222-2222-2222-222222222222',
  'singles', 'public', 'open', 'social', 'improving', 'intermediate', false
);

insert into public.match_zones (match_id, zone_id)
values ('d0000007-0000-0000-0000-000000000007', 'aaaaaaaa-0001-0001-0001-000000000002');

insert into public.match_participants (match_id, user_id, status, is_creator)
values (
  'd0000007-0000-0000-0000-000000000007',
  '22222222-2222-2222-2222-222222222222',
  'accepted',
  true
);

insert into public.match_time_options (id, match_id, starts_at, ends_at, proposed_by)
values (
  'e0000007-0000-0000-0000-000000000007',
  'd0000007-0000-0000-0000-000000000007',
  now() + interval '2 days',
  now() + interval '2 days 90 minutes',
  '22222222-2222-2222-2222-222222222222'
);

set local role authenticated;
select pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

select pg_temp.assert_true(
  public.create_and_publish_match(
    'doubles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    false,
    'M3 test match',
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '2 days')::text,
        'ends_at', (now() + interval '2 days 90 minutes')::text
      )
    ),
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  ) is not null,
  'eligible caller can create and publish a match'
);

select pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

select pg_temp.assert_true(
  public.join_match('d0000007-0000-0000-0000-000000000007') = 'accepted',
  'eligible player can instantly join an open public singles match'
);

select set_config(
  'request.jwt.claim.sub',
  '14141414-1414-1414-1414-141414141414',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  perform public.join_match('d0000007-0000-0000-0000-000000000007');
  raise exception 'expected full match join to fail';
exception
  when others then
    if sqlerrm not like '%match_full%' then
      raise;
    end if;
end;
$$;

select pg_temp.assert_true(true, 'third join attempt fails when singles match is full');

do $$
declare
  v_approval_match_id uuid;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_approval_match_id := pg_temp.create_test_match(
    '11111111-1111-1111-1111-111111111111',
    'singles',
    'public',
    true
  );

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');

  if public.join_match(v_approval_match_id) <> 'requested' then
    raise exception 'approval-required matches create a join request';
  end if;

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  perform public.respond_to_join_request(
    v_approval_match_id,
    '22222222-2222-2222-2222-222222222222',
    true
  );

  begin
    perform public.respond_to_join_request(
      v_approval_match_id,
      '22222222-2222-2222-2222-222222222222',
      true
    );
    raise exception 'expected duplicate accept to fail';
  exception
    when others then
      if sqlstate <> 'P0002' then
        raise;
      end if;
  end;
end;
$$;

select pg_temp.set_caller('22222222-2222-2222-2222-222222222222');

select pg_temp.assert_raises(
  $$select public.join_match('d6666666-6666-6666-6666-666666666666')$$,
  '42501',
  'private matches are not joinable without an invite'
);

select pg_temp.assert_raises(
  $$select public.join_match('d7777777-7777-7777-7777-777777777777')$$,
  '42501',
  'invite-only matches are not joinable without an invite'
);

do $$
declare
  v_match_id uuid;
begin
  v_match_id := pg_temp.create_test_match(
    '11111111-1111-1111-1111-111111111111',
    'singles',
    'public',
    false
  );

  perform pg_temp.set_caller('66666666-6666-6666-6666-666666666666');

  begin
    perform public.join_match(v_match_id);
    raise exception 'expected blocked join to fail';
  exception
    when others then
      if sqlstate <> '42501' then
        raise;
      end if;
  end;
end;
$$;

select pg_temp.assert_true(true, 'blocked users cannot join a creator match');

select pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

select pg_temp.assert_raises(
  $$select public.create_match_invite(
    'd0000007-0000-0000-0000-000000000007',
    '66666666-6666-6666-6666-666666666666'::uuid
  )$$,
  '42501',
  'blocked users cannot be invited'
);

select pg_temp.set_caller('12121212-1212-1212-1212-121212121212');

select pg_temp.assert_true(
  (
    select (public.get_match_hub('d7777777-7777-7777-7777-777777777777')).match_id
  ) = 'd7777777-7777-7777-7777-777777777777',
  'participants can load the match hub'
);

do $$
declare
  v_match_id uuid;
  v_token text;
begin
  v_match_id := pg_temp.create_test_match(
    '22222222-2222-2222-2222-222222222222',
    'doubles',
    'public',
    false
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller('14141414-1414-1414-1414-141414141414');
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller('88888888-8888-8888-8888-888888888888');
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller('12121212-1212-1212-1212-121212121212');

  begin
    perform public.join_match(v_match_id);
    raise exception 'expected doubles capacity enforcement to fail';
  exception
    when others then
      if sqlerrm not like '%match_full%' then
        raise;
      end if;
  end;
end;
$$;

select pg_temp.assert_true(true, 'doubles capacity cannot be exceeded');

do $$
declare
  v_match_id uuid;
  v_token text;
begin
  v_match_id := pg_temp.create_test_match(
    '11111111-1111-1111-1111-111111111111',
    'singles',
    'invite_only',
    false
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  select public.create_match_invite(v_match_id, null) into v_token;

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  perform public.accept_match_invite(v_token);

  perform pg_temp.set_caller('10101010-1010-1010-1010-101010101010');

  begin
    perform public.accept_match_invite(v_token);
    raise exception 'expected invite token reuse to fail';
  exception
    when others then
      if sqlerrm not like '%Invite not found or expired%' then
        raise;
      end if;
  end;
end;
$$;

select pg_temp.assert_true(true, 'invite tokens can only be accepted once');

do $$
declare
  v_match_id uuid;
  v_token text;
begin
  v_match_id := pg_temp.create_test_match(
    '11111111-1111-1111-1111-111111111111',
    'singles',
    'invite_only',
    false
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  select public.create_match_invite(v_match_id, null) into v_token;

  reset role;
  update public.match_invitations
  set expires_at = now() - interval '1 minute'
  where token_hash = public.hash_invite_token(v_token);
  set local role authenticated;

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');

  begin
    perform public.accept_match_invite(v_token);
    raise exception 'expected expired invite to fail';
  exception
    when others then
      if sqlerrm not like '%Invite not found or expired%' then
        raise;
      end if;
  end;
end;
$$;

select pg_temp.assert_true(true, 'expired invite tokens are rejected');

reset role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated',
  'authenticated',
  'discover-suspended-m3@example.invalid',
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
  id,
  display_name,
  is_adult_confirmed,
  account_status,
  onboarding_completed_at
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Suspended M3',
  true,
  'suspended',
  now()
)
on conflict (id) do update
set account_status = 'suspended';

insert into public.player_profiles (user_id, skill_band)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'intermediate')
on conflict (user_id) do nothing;

set local role authenticated;
select pg_temp.set_caller('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

select pg_temp.assert_raises(
  $$select public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '2 days')::text,
        'ends_at', (now() + interval '2 days 90 minutes')::text
      )
    ),
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  )$$,
  '42501',
  'suspended callers cannot create matches'
);

reset role;

set local role authenticated;

do $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
begin
  v_match_id := pg_temp.create_test_match(
    '11111111-1111-1111-1111-111111111111',
    'singles',
    'public',
    false
  );

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  perform public.join_match(v_match_id);
  perform public.leave_match(v_match_id);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);

  if v_hub.participant_count <> 1 then
    raise exception 'expected 1 participant after leave';
  end if;

  if v_hub.status <> 'open' then
    raise exception 'expected match to reopen after leave';
  end if;

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');

  if not exists (
    select 1
    from public.discover_open_matches() as d
    where d.match_id = v_match_id
  ) then
    raise exception 'departed player should see match in discover again';
  end if;

  perform public.join_match(v_match_id);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);

  if v_hub.participant_count <> 2 then
    raise exception 'expected rejoin to restore participant count';
  end if;
end;
$$;

select pg_temp.assert_true(true, 'leave frees capacity, discover visibility, and rejoin works');

select pass('Milestone 3 match participation authorization matrix passed');
select * from finish();

rollback;
