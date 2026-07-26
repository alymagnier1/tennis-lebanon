\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

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

do $$
declare
  v_club_id uuid;
  v_court_id uuid;
  v_detail jsonb;
  v_zone_id uuid;
  v_failed boolean;
begin
  select z.zone_id
  into v_zone_id
  from public.list_active_zones() as z
  limit 1;

  perform pg_temp.set_caller('55555555-5555-5555-5555-555555555555');

  v_club_id := public.register_pilot_club(
    'Onboarding Test Club',
    'onboarding-test-club',
    v_zone_id,
    'Pilot onboarding test',
    'Test address',
    null,
    null,
    array['parking']::text[],
    jsonb_build_array(
      jsonb_build_object(
        'name', 'Court A',
        'surface', 'hard',
        'is_indoor', false,
        'price_minor', 5000,
        'currency', 'USD',
        'slot_minutes', 90
      )
    )
  );

  v_detail := public.get_club_admin_detail(v_club_id);
  if (v_detail->'club'->>'name') <> 'Onboarding Test Club' then
    raise exception 'admin detail name mismatch';
  end if;

  v_court_id := (v_detail->'courts'->0->>'court_id')::uuid;

  perform public.update_club_profile(
    v_club_id,
    'Onboarding Test Club Updated',
    'Updated description',
    'Updated address',
    null,
    null,
    array['parking', 'showers']::text[]
  );

  perform public.upsert_club_court(
    v_club_id,
    v_court_id,
    'Court A',
    'clay',
    false,
    5500,
    'USD',
    90
  );

  perform public.set_court_weekly_hours(
    v_court_id,
    jsonb_build_array(
      jsonb_build_object('weekday', 1, 'opens_at', '08:00', 'closes_at', '21:00')
    )
  );

  perform public.create_court_block(
    v_court_id,
    now() + interval '10 days',
    now() + interval '10 days 2 hours',
    'Maintenance'
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_failed := false;
  begin
    perform public.get_club_admin_detail(v_club_id);
    v_failed := true;
  exception
    when others then
      null;
  end;
  if v_failed then
    raise exception 'player should not read club admin detail';
  end if;

  perform pg_temp.set_caller('55555555-5555-5555-5555-555555555555');
  if not exists (
    select 1
    from public.list_clubs_directory(null) as d
    where d.club_id = v_club_id
      and d.min_price_minor = 5500
  ) then
    raise exception 'updated court price should appear in directory';
  end if;
end;
$$;

select pass('club admin onboarding and configuration RPCs');

rollback;
