\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(2);

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
        p_message, p_expected_state, sqlstate, sqlerrm;
  end;

  raise exception
    'assertion failed: % (expected SQLSTATE %, but it succeeded)',
    p_message, p_expected_state;
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
-- Saving replaces the whole set and keeps the order the player chose.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_north uuid := 'aaaaaaaa-0001-0001-0001-000000000001';
  v_central uuid := 'aaaaaaaa-0001-0001-0001-000000000002';
  v_south uuid := 'aaaaaaaa-0001-0001-0001-000000000003';
  v_zones uuid[];
begin
  perform pg_temp.set_caller(v_user);

  perform public.set_player_preferred_zones(array[v_south, v_north]);

  set local role postgres;
  select array_agg(pz.zone_id order by pz.priority)
  into v_zones
  from public.player_zones as pz
  where pz.user_id = v_user;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_zones = array[v_south, v_north],
    'zones should be stored in the order they were supplied'
  );

  -- A second save must replace rather than accumulate, or a player who trims
  -- their areas silently keeps the old ones.
  perform public.set_player_preferred_zones(array[v_central]);

  set local role postgres;
  select array_agg(pz.zone_id)
  into v_zones
  from public.player_zones as pz
  where pz.user_id = v_user;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_zones = array[v_central],
    'saving a smaller set should drop the zones that were removed'
  );
end;
$$;

select ok(true, 'preferred zones are replaced wholesale and keep their order');

-- ---------------------------------------------------------------------------
-- Every rejection path. A bad set here makes a player undiscoverable, so the
-- function refuses rather than storing something half-valid.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_north uuid := 'aaaaaaaa-0001-0001-0001-000000000001';
begin
  perform pg_temp.set_caller(v_user);

  perform pg_temp.assert_raises(
    'select public.set_player_preferred_zones(array[]::uuid[])',
    '22023',
    'an empty zone list should be refused'
  );

  perform pg_temp.assert_raises(
    format('select public.set_player_preferred_zones(array[%L, %L]::uuid[])', v_north, v_north),
    '22023',
    'duplicate zones should be refused'
  );

  perform pg_temp.assert_raises(
    'select public.set_player_preferred_zones(array[gen_random_uuid()]::uuid[])',
    '22023',
    'a zone that does not exist should be refused'
  );

  perform pg_temp.assert_raises(
    'select public.set_player_preferred_zones(null::uuid[])',
    '22023',
    'a null zone list should be refused'
  );
end;
$$;

select ok(true, 'preferred zones reject empty, duplicate, unknown, and null input');

select * from finish();

rollback;
