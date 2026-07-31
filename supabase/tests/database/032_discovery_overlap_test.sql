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
-- set_recurring_availability replaces the weekly grid atomically
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_written integer;
  v_recurring integer;
  v_one_off_before integer;
  v_one_off_after integer;
begin
  perform pg_temp.set_caller(v_user);

  set local role postgres;
  insert into public.availability_windows (
    user_id, starts_at, ends_at, timezone, is_recurring
  )
  values (
    v_user,
    now() + interval '2 days',
    now() + interval '2 days 2 hours',
    'Asia/Beirut',
    false
  );

  select count(*) into v_one_off_before
  from public.availability_windows
  where user_id = v_user and is_recurring = false;
  set local role authenticated;

  v_written := public.set_recurring_availability(
    jsonb_build_array(
      jsonb_build_object('weekday', 1, 'local_start', '17:00', 'local_end', '22:00'),
      jsonb_build_object('weekday', 3, 'local_start', '17:00', 'local_end', '22:00'),
      jsonb_build_object('weekday', 6, 'local_start', '07:00', 'local_end', '12:00')
    )
  );

  perform pg_temp.assert_true(v_written = 3, 'should report three saved windows');

  set local role postgres;
  select count(*) into v_recurring
  from public.availability_windows
  where user_id = v_user and is_recurring = true;

  select count(*) into v_one_off_after
  from public.availability_windows
  where user_id = v_user and is_recurring = false;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_recurring = 3,
    'recurring windows should be replaced wholesale, not appended'
  );
  perform pg_temp.assert_true(
    v_one_off_after = v_one_off_before,
    'one-off windows must survive a recurring grid save'
  );

  -- A second save with fewer rows must shrink the set rather than accumulate.
  v_written := public.set_recurring_availability(
    jsonb_build_array(
      jsonb_build_object('weekday', 1, 'local_start', '17:00', 'local_end', '22:00')
    )
  );

  set local role postgres;
  select count(*) into v_recurring
  from public.availability_windows
  where user_id = v_user and is_recurring = true;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_recurring = 1,
    'saving a smaller grid should remove the windows that were dropped'
  );
end;
$$;

select pass('set_recurring_availability replaces the weekly grid atomically');

-- ---------------------------------------------------------------------------
-- Invalid grids are rejected
-- ---------------------------------------------------------------------------

do $$
declare
  v_message text := '';
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  begin
    perform public.set_recurring_availability(
      jsonb_build_array(
        jsonb_build_object('weekday', 9, 'local_start', '17:00', 'local_end', '22:00')
      )
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%Weekday must be 0-6%',
    format('an out-of-range weekday must be rejected, got: %s', v_message)
  );

  v_message := '';
  begin
    perform public.set_recurring_availability(
      jsonb_build_array(
        jsonb_build_object('weekday', 2, 'local_start', '20:00', 'local_end', '18:00')
      )
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%End time must be after start time%',
    format('an inverted window must be rejected, got: %s', v_message)
  );
end;
$$;

select pass('invalid availability grids are rejected');

-- ---------------------------------------------------------------------------
-- Discovery surfaces the concrete shared interval
-- ---------------------------------------------------------------------------

do $$
declare
  v_viewer uuid := '11111111-1111-1111-1111-111111111111';
  v_other uuid := '22222222-2222-2222-2222-222222222222';
  v_card public.discover_compatible_player_card;
  v_found boolean := false;
begin
  -- Both players free Monday evening, so an overlap must exist and be returned.
  perform pg_temp.set_caller(v_viewer);
  perform public.set_recurring_availability(
    jsonb_build_array(
      jsonb_build_object('weekday', 1, 'local_start', '17:00', 'local_end', '22:00')
    )
  );

  perform pg_temp.set_caller(v_other);
  perform public.set_recurring_availability(
    jsonb_build_array(
      jsonb_build_object('weekday', 1, 'local_start', '18:00', 'local_end', '21:00')
    )
  );

  perform pg_temp.set_caller(v_viewer);

  for v_card in
    select *
    from public.discover_compatible_players(
      null, null, null, false, 14, 4, 50, null
    )
  loop
    if v_card.user_id = v_other then
      v_found := true;
      perform pg_temp.assert_true(
        v_card.availability_overlap,
        'players sharing Monday evening should report an overlap'
      );
      perform pg_temp.assert_true(
        v_card.overlap_starts_at is not null
          and v_card.overlap_ends_at is not null,
        'the concrete overlap interval should be populated'
      );
      perform pg_temp.assert_true(
        v_card.overlap_ends_at > v_card.overlap_starts_at,
        'the overlap interval must be non-empty'
      );
      perform pg_temp.assert_true(
        extract(epoch from (v_card.overlap_ends_at - v_card.overlap_starts_at)) >= 3600,
        'the overlap interval must be at least one hour'
      );
    end if;
  end loop;

  perform pg_temp.assert_true(
    v_found,
    'the other player should be discoverable without requiring overlap filtering'
  );
end;
$$;

select pass('discovery returns the concrete shared interval');

select * from finish();
rollback;
