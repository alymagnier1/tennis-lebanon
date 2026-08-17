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
 * Players the caller sees as free in one specific block.
 *
 * Asserted as deltas throughout: the seed carries its own recurring windows, so
 * an absolute count would break the day someone edits the fixture.
 */
create or replace function pg_temp.block_count(p_block_start timestamptz)
returns integer
language sql
as $$
  select coalesce(
    (
      select l.player_count
      from public.get_availability_liquidity() as l
      where l.starts_at = p_block_start
    ),
    0
  );
$$;

do $$
declare
  -- Player A (pilot-north + pilot-central) looking at Player J (pilot-central).
  v_viewer uuid := '11111111-1111-1111-1111-111111111111';
  v_target uuid := '14141414-1414-1414-1414-141414141414';
  -- Five days out, so the block is wholly in the future and `usable_from` never
  -- trims it. Derived from now() rather than hardcoded, so the test does not rot.
  v_day date := (now() at time zone 'Asia/Beirut')::date + 5;
  v_start timestamptz := (v_day + time '07:00') at time zone 'Asia/Beirut';
  v_end timestamptz := (v_day + time '12:00') at time zone 'Asia/Beirut';
  v_base integer;
begin
  -- Own the target's availability outright so the deltas below are unambiguous.
  delete from public.availability_windows where user_id = v_target;

  perform pg_temp.set_caller(v_viewer);
  v_base := pg_temp.block_count(v_start);

  -- One free player is one more in the count.
  insert into public.availability_windows (user_id, starts_at, ends_at, is_recurring)
  values (v_target, v_start, v_end, false);

  perform pg_temp.assert_true(
    pg_temp.block_count(v_start) = v_base + 1,
    format('a free player should raise the count, expected %s', v_base + 1)
  );

  -- A second overlapping window is the same person, not a second opening.
  insert into public.availability_windows (user_id, starts_at, ends_at, is_recurring)
  values (v_target, v_start + interval '1 hour', v_end, false);

  perform pg_temp.assert_true(
    pg_temp.block_count(v_start) = v_base + 1,
    'two overlapping windows for one player must count once'
  );

  -- Blocking removes them, in either direction.
  insert into public.user_blocks (blocker_id, blocked_id) values (v_viewer, v_target);
  perform pg_temp.assert_true(
    pg_temp.block_count(v_start) = v_base,
    'a blocked player must not be counted'
  );
  delete from public.user_blocks where blocker_id = v_viewer and blocked_id = v_target;

  -- The caller is never their own liquidity.
  delete from public.availability_windows where user_id = v_target;
  insert into public.availability_windows (user_id, starts_at, ends_at, is_recurring)
  values (v_viewer, v_start, v_end, false);

  perform pg_temp.assert_true(
    pg_temp.block_count(v_start) = v_base,
    'the caller must not count themselves as free'
  );
  delete from public.availability_windows
  where user_id = v_viewer and starts_at = v_start;

  -- Under an hour inside the block is not a game.
  insert into public.availability_windows (user_id, starts_at, ends_at, is_recurring)
  values (v_target, v_start, v_start + interval '45 minutes', false);

  perform pg_temp.assert_true(
    pg_temp.block_count(v_start) = v_base,
    'a 45-minute window is below the one-hour floor'
  );

  update public.availability_windows
  set ends_at = v_start + interval '60 minutes'
  where user_id = v_target;

  perform pg_temp.assert_true(
    pg_temp.block_count(v_start) = v_base + 1,
    'exactly one hour inside the block should count'
  );

  -- A block already finished is not an offer.
  perform pg_temp.assert_true(
    not exists (
      select 1 from public.get_availability_liquidity() as l where l.ends_at <= now()
    ),
    'no block that has already ended may be returned'
  );

  -- The horizon is clamped, so a caller cannot ask for a year of blocks.
  perform pg_temp.assert_true(
    (
      select coalesce(max((l.starts_at at time zone 'Asia/Beirut')::date), v_day)
      from public.get_availability_liquidity(365) as l
    ) <= (now() at time zone 'Asia/Beirut')::date + 13,
    'the horizon must clamp to 14 days'
  );
end;
$$;

select ok(true, 'availability liquidity counts distinct, eligible, free players');

select * from finish();

rollback;
