\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(4);

create or replace function pg_temp.assert_true(
  p_condition boolean,
  p_description text
)
returns void
language plpgsql
as $$
begin
  if not p_condition then
    raise exception '%', p_description;
  end if;
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

set local role authenticated;

-- ---------------------------------------------------------------------------
-- SEC-004: a block must bar the whole roster, not just the creator
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_participant uuid := '22222222-2222-2222-2222-222222222222';
  v_blocker uuid := '66666666-6666-6666-6666-666666666666';
  v_match_id uuid;
  v_existing_id uuid;
  v_failed boolean;
begin
  perform pg_temp.set_caller(v_creator);

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = 'doubles'
      and lm.status in ('draft', 'open', 'full', 'ready_to_book')
  loop
    begin
      perform public.cancel_match(v_existing_id, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;

  -- Doubles so the match still has room after the second player joins.
  v_match_id := public.create_and_publish_match(
    'doubles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'beginner'::public.skill_band,
    'competitive'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '4 days')::text,
        'ends_at', (now() + interval '4 days 90 minutes')::text
      )
    )
  );

  perform pg_temp.set_caller(v_participant);
  perform public.join_match(v_match_id);

  -- The blocker has no relationship with the creator, only with a participant.
  perform pg_temp.set_caller(v_blocker);
  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_blocker, v_participant)
  on conflict do nothing;

  v_failed := false;
  begin
    perform public.join_match(v_match_id);
  exception
    when others then
      v_failed := true;
  end;

  perform pg_temp.assert_true(
    v_failed,
    'joining a match containing a blocked user must be refused'
  );
end;
$$;

select pass('blocks are enforced against every accepted participant');

-- ---------------------------------------------------------------------------
-- SEC-002: suspended staff lose club powers
-- ---------------------------------------------------------------------------

do $$
declare
  v_staff uuid := '33333333-3333-3333-3333-333333333333';
  v_club uuid := 'bbbbbbbb-0001-0001-0001-000000000001';
  v_was_staff boolean;
  v_is_staff boolean;
begin
  set local role postgres;
  v_was_staff := public.is_club_staff(v_club, v_staff);

  update public.profiles
  set account_status = 'suspended'
  where id = v_staff;

  v_is_staff := public.is_club_staff(v_club, v_staff);

  update public.profiles
  set account_status = 'active'
  where id = v_staff;

  set local role authenticated;

  perform pg_temp.assert_true(v_was_staff, 'fixture user should start as club staff');
  perform pg_temp.assert_true(
    not v_is_staff,
    'suspended account must lose club staff authority'
  );
end;
$$;

select pass('suspended accounts lose club staff authority');

-- ---------------------------------------------------------------------------
-- SEC-003: the probe-able overload is not callable by clients
-- ---------------------------------------------------------------------------

do $$
declare
  v_failed boolean := false;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  begin
    perform public.is_platform_operator(
      '55555555-5555-5555-5555-555555555555'::uuid
    );
  exception
    when insufficient_privilege then
      v_failed := true;
  end;

  perform pg_temp.assert_true(
    v_failed,
    'clients must not be able to probe platform-operator status of others'
  );

  perform pg_temp.assert_true(
    public.viewer_is_platform_operator() = false,
    'a player is not a platform operator'
  );
end;
$$;

select pass('platform operator status is not enumerable by clients');

-- ---------------------------------------------------------------------------
-- Zone hygiene: a retired zone cannot be used for a new match
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '88888888-8888-8888-8888-888888888888';
  v_zone_id uuid := 'aaaaaaaa-0001-0001-0001-000000000003';
  v_message text := '';
  v_existing_id uuid;
begin
  set local role postgres;
  update public.zones set is_active = false where id = v_zone_id;
  set local role authenticated;

  perform pg_temp.set_caller(v_creator);

  -- The seed already gives this player a hosted singles match, which would
  -- otherwise fail with active_hosted_match_exists before the zone is checked.
  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = 'singles'
      and lm.status in ('draft', 'open', 'full', 'ready_to_book')
  loop
    begin
      perform public.cancel_match(v_existing_id, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;

  begin
    perform public.create_match_draft(
      'singles'::public.match_format,
      'public'::public.match_visibility,
      'social'::public.play_intent,
      'beginner'::public.skill_band,
      'competitive'::public.skill_band,
      false,
      null,
      array[v_zone_id]::uuid[],
      jsonb_build_array(
        jsonb_build_object(
          'starts_at', (now() + interval '5 days')::text,
          'ends_at', (now() + interval '5 days 90 minutes')::text
        )
      )
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  set local role postgres;
  update public.zones set is_active = true where id = v_zone_id;
  set local role authenticated;

  -- Assert the specific reason, so an unrelated failure cannot make this pass.
  perform pg_temp.assert_true(
    v_message like '%Zone is not available%',
    format(
      'a retired zone must be rejected with a zone error, got: %s',
      coalesce(nullif(v_message, ''), '<no error raised>')
    )
  );
end;
$$;

select pass('retired zones are rejected at match creation');

select * from finish();
rollback;
