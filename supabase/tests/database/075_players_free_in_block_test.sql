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

/**
 * The players the caller would see behind a block's count.
 *
 * Zone-scoped on purpose: `get_availability_liquidity` resolves the caller's own
 * zones, while `discover_compatible_players` leaves zones unrestricted unless
 * asked. Passing them here is what keeps the two in step, and omitting them is
 * exactly the mismatch this test exists to catch.
 */
create or replace function pg_temp.block_players(
  p_viewer uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns integer
language sql
as $$
  select count(*)::integer
  from public.discover_compatible_players(
    (
      select array_agg(pz.zone_id)
      from public.player_zones as pz
      where pz.user_id = p_viewer
    ),
    null, null, false, 14, 4, 50, null, p_start, p_end
  );
$$;

do $$
declare
  v_viewer uuid := '11111111-1111-1111-1111-111111111111';
  v_target uuid := '14141414-1414-1414-1414-141414141414';
  v_day date := (now() at time zone 'Asia/Beirut')::date + 5;
  v_start timestamptz := (v_day + time '07:00') at time zone 'Asia/Beirut';
  v_end timestamptz := (v_day + time '12:00') at time zone 'Asia/Beirut';
  v_other_start timestamptz := (v_day + time '17:00') at time zone 'Asia/Beirut';
  v_other_end timestamptz := (v_day + time '22:00') at time zone 'Asia/Beirut';
  v_row record;
  v_listed integer;
  v_checked integer := 0;
begin
  perform pg_temp.set_caller(v_viewer);

  /*
   * The invariant the whole feature rests on: Home prints a count, and tapping it
   * opens this list. If the two ever diverge, "5 free" opens onto four players and
   * the number stops meaning anything. Checked for every block in the week, not a
   * sampled one.
   */
  for v_row in select * from public.get_availability_liquidity()
  loop
    -- Listed once into a variable rather than called twice. PL/pgSQL evaluates
    -- both arguments of `assert_true` before entering it, so building the
    -- failure message re-ran the whole discovery query on every passing
    -- iteration -- two rate-limited calls per block where one was needed. With
    -- enough availability seeded that doubling crossed the 30-per-minute limit
    -- in `enforce_discovery_rate_limit` and the test aborted before asserting
    -- anything, which reads as a broken feature rather than a self-inflicted
    -- throttle.
    v_listed := pg_temp.block_players(v_viewer, v_row.starts_at, v_row.ends_at);

    perform pg_temp.assert_true(
      v_row.player_count = v_listed,
      format(
        'count and list must agree for %s: count said %s, list had %s',
        v_row.starts_at,
        v_row.player_count,
        v_listed
      )
    );
    v_checked := v_checked + 1;
  end loop;

  perform pg_temp.assert_true(
    v_checked > 0,
    'the seed should produce at least one block with liquidity to compare'
  );

  -- The filter restricts: free in the evening is not free in the morning.
  delete from public.availability_windows where user_id = v_target;
  insert into public.availability_windows (user_id, starts_at, ends_at, is_recurring)
  values (v_target, v_other_start, v_other_end, false);

  perform pg_temp.assert_true(
    not exists (
      select 1
      from public.discover_compatible_players(
        null, null, null, false, 14, 4, 50, null, v_start, v_end
      ) as p
      where p.user_id = v_target
    ),
    'a player free only in the evening must not appear in the morning block'
  );

  perform pg_temp.assert_true(
    exists (
      select 1
      from public.discover_compatible_players(
        null, null, null, false, 14, 4, 50, null, v_other_start, v_other_end
      ) as p
      where p.user_id = v_target
    ),
    'a player free in the evening must appear in the evening block'
  );

  -- Below the one-hour floor is excluded here exactly as it is in the count.
  delete from public.availability_windows where user_id = v_target;
  insert into public.availability_windows (user_id, starts_at, ends_at, is_recurring)
  values (v_target, v_start, v_start + interval '45 minutes', false);

  perform pg_temp.assert_true(
    not exists (
      select 1
      from public.discover_compatible_players(
        null, null, null, false, 14, 4, 50, null, v_start, v_end
      ) as p
      where p.user_id = v_target
    ),
    'a 45-minute window must not put a player in the block list'
  );

  /*
   * Omitting the window must leave discovery exactly as it was. The parameters are
   * optional additions to a function every Discover load already calls, so a
   * regression here would empty the main feed rather than this one screen.
   */
  perform pg_temp.assert_true(
    (
      select count(*)
      from public.discover_compatible_players(null, null, null, false, 14, 1, 50, null)
    ) = (
      select count(*)
      from public.discover_compatible_players(
        p_zone_ids => null,
        p_format => null,
        p_intent => null,
        p_require_availability_overlap => false,
        p_horizon_days => 14,
        p_level_window => 1,
        p_limit => 50,
        p_cursor_user_id => null
      )
    ),
    'the original eight-argument call must behave the same positionally and by name'
  );

  perform pg_temp.assert_true(
    (
      select count(*)
      from public.discover_compatible_players(null, null, null, false, 14, 4, 50, null)
    ) >= (
      select count(*)
      from public.discover_compatible_players(
        null, null, null, false, 14, 4, 50, null, v_start, v_end
      )
    ),
    'filtering to a block can only narrow the unfiltered result'
  );

  -- One function of this name: adding parameters must not leave an overload behind,
  -- which would make every existing eight-argument call ambiguous.
  perform pg_temp.assert_true(
    (
      select count(*)
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'discover_compatible_players'
    ) = 1,
    'discover_compatible_players must not be overloaded'
  );
end;
$$;

select ok(true, 'block player list agrees with the liquidity count it opens from');

select * from finish();

rollback;
