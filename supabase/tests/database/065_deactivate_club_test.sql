\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

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

create or replace function pg_temp.create_ready_match(p_creator_id uuid, p_joiner_id uuid)
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
      and lm.format = 'singles'
      and lm.status in ('draft', 'open', 'full', 'ready_to_book', 'booking_pending')
  loop
    begin
      perform public.cancel_match(v_existing_id, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;

  select public.create_and_publish_match(
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
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      )
    ),
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  )
  into v_match_id;

  perform pg_temp.set_caller(p_joiner_id);
  perform public.join_match(v_match_id);

  return v_match_id;
end;
$$;

-- postgres throughout: auth.uid() resolves from the JWT claim set by
-- pg_temp.set_caller regardless of session role (auth.uid() reads
-- request.jwt.claim.sub), and the direct audit_events / clubs reads below
-- need to bypass table grants that authenticated was never given -- every
-- real caller reaches this data through the security-definer RPCs, which
-- enforce their own authorization independent of session role.
set local role postgres;

-- ---------------------------------------------------------------------------
-- An operator can retire a club with no open bookings, and undo it
-- ---------------------------------------------------------------------------

do $$
declare
  v_operator uuid := '55555555-5555-5555-5555-555555555555';
  v_player uuid := '11111111-1111-1111-1111-111111111111';
  v_zone uuid;
  v_club uuid;
begin
  select z.id into v_zone from public.zones as z where z.is_active limit 1;
  perform pg_temp.set_caller(v_operator);

  v_club := public.register_pilot_club(
    'Deactivation Test Club', 'deactivation-test-club', v_zone,
    null, null, null, null, '{}'::text[],
    jsonb_build_array(jsonb_build_object('name', 'Court 1', 'price_minor', 4000)),
    'external_link', '+961 70 111 222', true
  );

  -- register_pilot_club(asOperator) goes live immediately (050), so a player
  -- should see it right away in the same directory listing the app uses.
  perform pg_temp.set_caller(v_player);
  perform pg_temp.assert_true(
    exists (select 1 from public.list_clubs_directory() as d where d.club_id = v_club),
    'newly registered club should be visible to players'
  );

  perform pg_temp.set_caller(v_operator);
  perform public.deactivate_club(v_club, 'closing for renovation');

  perform pg_temp.set_caller(v_player);
  perform pg_temp.assert_true(
    not exists (select 1 from public.list_clubs_directory() as d where d.club_id = v_club),
    'a player must not see a deactivated club in the directory'
  );

  perform pg_temp.set_caller(v_operator);

  perform pg_temp.assert_true(
    exists (
      select 1 from public.audit_events
      where entity_type = 'club' and entity_id = v_club and action = 'club_deactivated'
    ),
    'deactivation must leave an audit trail'
  );

  -- Idempotency guard
  declare
    v_message text;
  begin
    begin
      perform public.deactivate_club(v_club);
      v_message := 'no error';
    exception when others then
      v_message := sqlerrm;
    end;
    perform pg_temp.assert_true(
      v_message = 'Club is already inactive',
      format('deactivating an already-inactive club should fail clearly, got: %s', v_message)
    );
  end;

  perform public.reactivate_club(v_club, 'renovation done');

  perform pg_temp.set_caller(v_player);
  perform pg_temp.assert_true(
    exists (select 1 from public.list_clubs_directory() as d where d.club_id = v_club),
    'a reactivated club must be visible to players again'
  );

  perform pg_temp.set_caller(v_operator);
  perform pg_temp.assert_true(
    exists (
      select 1 from public.audit_events
      where entity_type = 'club' and entity_id = v_club and action = 'club_reactivated'
    ),
    'reactivation must leave an audit trail'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- A club with an open booking refuses to deactivate
-- ---------------------------------------------------------------------------

do $$
declare
  v_operator uuid := '55555555-5555-5555-5555-555555555555';
  v_pilot uuid := 'bbbbbbbb-0001-0001-0001-000000000001';
  v_match_id uuid;
  v_booking_id uuid;
  v_message text;
begin
  v_match_id := pg_temp.create_ready_match(
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_booking_id := public.request_match_booking(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001'
  );

  perform pg_temp.set_caller(v_operator);
  begin
    perform public.deactivate_club(v_pilot);
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like 'Club has 1 open booking%',
    format('deactivation with an open booking should be refused, got: %s', v_message)
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  perform pg_temp.assert_true(
    exists (select 1 from public.list_clubs_directory() as d where d.club_id = v_pilot),
    'club with an open booking must remain active and visible'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Nobody short of a platform operator may deactivate a club
-- ---------------------------------------------------------------------------

do $$
declare
  v_club_admin uuid := '44444444-4444-4444-4444-444444444444';
  v_player uuid := '11111111-1111-1111-1111-111111111111';
  v_pilot uuid := 'bbbbbbbb-0001-0001-0001-000000000001';
  v_message text;
begin
  -- The club's own admin runs it day to day but does not get to take it
  -- offline platform-wide.
  perform pg_temp.set_caller(v_club_admin);
  begin
    perform public.deactivate_club(v_pilot);
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message = 'Platform operator role required',
    format('a club admin must not deactivate their own club, got: %s', v_message)
  );

  perform pg_temp.set_caller(v_player);
  begin
    perform public.deactivate_club(v_pilot);
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message = 'Platform operator role required',
    format('a player must not deactivate a club, got: %s', v_message)
  );
end;
$$;

select pass('platform operators can deactivate and reactivate clubs');

rollback;
