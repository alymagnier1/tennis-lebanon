\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(5);

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

-- Viewer 1111 (intermediate) and target 1313 (advanced, one band apart) share no
-- availability in the seed: 1111 is free Fri evening + Sat morning, 1313 only
-- Sun-Tue evening. Giving both a single one-off window nine days out creates an
-- overlap that is deliberately outside the three-day near-term window and
-- inside the fourteen-day horizon, so the two windows can be told apart no
-- matter which weekday the suite runs on.
do $$
declare
  v_viewer uuid := '11111111-1111-1111-1111-111111111111';
  v_target uuid := '13131313-1313-1313-1313-131313131313';
  v_blocked uuid := '66666666-6666-6666-6666-666666666666';
  v_found boolean;
  v_overlap_start timestamptz;
  v_near_term jsonb;
begin
  insert into public.availability_windows (
    user_id, starts_at, ends_at, timezone, is_recurring
  )
  values
    (v_viewer, now() + interval '9 days', now() + interval '9 days 3 hours', 'Asia/Beirut', false),
    (v_target, now() + interval '9 days', now() + interval '9 days 3 hours', 'Asia/Beirut', false);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Regression: the overlap filter must run over p_horizon_days. It was once
  -- wired to the near-term window, which silently capped every search at three
  -- days and hid players whose next shared slot was further out.
  select exists (
    select 1
    from public.discover_compatible_players(
      p_require_availability_overlap => true,
      p_horizon_days => 14,
      p_level_window => 1
    ) as result
    where result.user_id = v_target
  ) into v_found;

  perform pg_temp.assert_true(
    v_found,
    'a shared slot nine days out should satisfy the overlap filter over a 14-day horizon'
  );

  -- The opposite direction: a caller who asks for a two-day horizon must not
  -- see that player, or the filter is not reading the parameter at all.
  select exists (
    select 1
    from public.discover_compatible_players(
      p_require_availability_overlap => true,
      p_horizon_days => 2,
      p_level_window => 1
    ) as result
    where result.user_id = v_target
  ) into v_found;

  perform pg_temp.assert_true(
    not v_found,
    'a shared slot nine days out must not satisfy the overlap filter over a 2-day horizon'
  );

  select result.overlap_starts_at, result.near_term_overlap_slots
  into v_overlap_start, v_near_term
  from public.discover_compatible_players(
    p_require_availability_overlap => true,
    p_horizon_days => 14,
    p_level_window => 1
  ) as result
  where result.user_id = v_target;

  -- overlap_starts_at prefills the time when the viewer taps through to create
  -- a match, so it has to look across the whole horizon.
  perform pg_temp.assert_true(
    v_overlap_start is not null,
    'overlap_starts_at should report the earliest shared slot within the horizon'
  );

  -- near_term_overlap_slots stays narrow: it only feeds the compact card chips.
  perform pg_temp.assert_true(
    coalesce(jsonb_array_length(v_near_term), 0) = 0,
    'near_term_overlap_slots should stay inside the three-day window'
  );

  -- Privacy: a blocked player must be indistinguishable from one who does not
  -- exist, rather than raising a distinct "blocked" error that confirms them.
  perform pg_temp.assert_raises(
    format('select public.get_public_player_card(%L)', v_blocked),
    'P0002',
    'a blocked player must not be readable through the public card'
  );
end;
$$;

select pass('discover near-term availability separates horizon from display window');
select pass('horizon filter honours p_horizon_days in both directions');
select pass('overlap_starts_at spans the horizon');
select pass('near_term_overlap_slots stays inside three days');
select pass('blocked players are not readable through the public card');

select * from finish();

rollback;
