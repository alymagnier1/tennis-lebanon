\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(3);

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
-- Day-part boundaries. These decide what every discover card and profile says
-- a player is free, so the edges matter more than the midpoints.
-- ---------------------------------------------------------------------------

do $$
begin
  perform pg_temp.assert_true(
    public.availability_day_part_from_local(time '07:00') = 'morning',
    'the morning block should start at 07:00'
  );
  perform pg_temp.assert_true(
    public.availability_day_part_from_local(time '11:59') = 'morning',
    '11:59 should still be morning'
  );
  perform pg_temp.assert_true(
    public.availability_day_part_from_local(time '12:00') = 'afternoon',
    'afternoon should start exactly at noon'
  );
  perform pg_temp.assert_true(
    public.availability_day_part_from_local(time '16:59') = 'afternoon',
    '16:59 should still be afternoon'
  );
  perform pg_temp.assert_true(
    public.availability_day_part_from_local(time '17:00') = 'evening',
    'evening should start at 17:00'
  );

  -- The two wrap-around branches: before dawn counts as morning, and anything
  -- from 22:00 falls through to evening rather than returning null.
  perform pg_temp.assert_true(
    public.availability_day_part_from_local(time '05:30') = 'morning',
    'an early start before 07:00 should count as morning'
  );
  perform pg_temp.assert_true(
    public.availability_day_part_from_local(time '23:30') = 'evening',
    'a late start after 22:00 should count as evening'
  );
end;
$$;

select ok(true, 'availability day parts hold at every boundary');

-- ---------------------------------------------------------------------------
-- The public availability summary reflects what the player actually saved.
-- ---------------------------------------------------------------------------

do $$
declare
  v_viewer uuid := '11111111-1111-1111-1111-111111111111';
  v_target uuid := '13131313-1313-1313-1313-131313131313';
  v_summary jsonb;
begin
  perform pg_temp.set_caller(v_target);
  perform public.set_recurring_availability(
    jsonb_build_array(
      jsonb_build_object('weekday', 2, 'local_start', '18:00', 'local_end', '21:00'),
      jsonb_build_object('weekday', 4, 'local_start', '09:00', 'local_end', '11:00')
    )
  );

  perform pg_temp.set_caller(v_viewer);
  v_summary := public.get_public_player_availability_summary(v_target);

  perform pg_temp.assert_true(
    v_summary -> 'weekdays' @> '[2, 4]'::jsonb,
    format('the summary should list every weekday saved, got %s', v_summary -> 'weekdays')
  );

  perform pg_temp.assert_true(
    v_summary -> 'day_parts' @> '["morning", "evening"]'::jsonb,
    format('the summary should derive both blocks, got %s', v_summary -> 'day_parts')
  );

  -- Your own card is not what this RPC is for, and letting it through would
  -- quietly widen what the public shape is allowed to expose.
  begin
    perform public.get_public_player_availability_summary(v_viewer);
    raise exception 'the summary should refuse the caller own id';
  exception
    when others then
      perform pg_temp.assert_true(
        sqlerrm like '%own public availability%',
        format('expected a refusal for own id, got: %s', sqlerrm)
      );
  end;
end;
$$;

select ok(true, 'the public availability summary reports the saved grid');

-- ---------------------------------------------------------------------------
-- Recent matches must not leak a blocked player by name.
--
-- Regression for the fix in 037: the opponent list aggregates every accepted
-- participant, so without a block check someone you blocked surfaces inside a
-- third party match history.
-- ---------------------------------------------------------------------------

do $$
declare
  v_viewer uuid := '11111111-1111-1111-1111-111111111111';
  v_blocked uuid := '66666666-6666-6666-6666-666666666666';
  v_visible uuid := '13131313-1313-1313-1313-131313131313';
  v_message text := '';
  v_rows integer;
begin
  perform pg_temp.set_caller(v_viewer);

  begin
    perform * from public.list_public_player_recent_matches(v_blocked, 5);
    raise exception 'a blocked player should not be readable at all';
  exception
    when others then
      v_message := sqlerrm;
  end;

  -- "Player not found" rather than an empty list or a distinct "blocked"
  -- error: a blocked player must be indistinguishable from one who is not
  -- there, or the error itself confirms they exist.
  perform pg_temp.assert_true(
    v_message like '%Player not found%',
    format('expected a not-found refusal for a blocked player, got: %s', v_message)
  );

  -- Guard against the refusal being unconditional, which would pass the check
  -- above while breaking the feature for everyone.
  select count(*)
  into v_rows
  from public.list_public_player_recent_matches(v_visible, 5);

  perform pg_temp.assert_true(
    v_rows >= 0,
    'an unblocked player should still be readable'
  );
end;
$$;

select ok(true, 'a blocked player is indistinguishable from one who does not exist');

select * from finish();

rollback;
