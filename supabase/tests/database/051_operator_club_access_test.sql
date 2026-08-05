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

-- ---------------------------------------------------------------------------
-- A club ops entered must not vanish from the dashboard that entered it
-- ---------------------------------------------------------------------------

do $$
declare
  v_operator uuid := '55555555-5555-5555-5555-555555555555';
  v_zone uuid;
  v_club uuid;
  v_detail jsonb;
begin
  select z.id into v_zone from public.zones as z where z.is_active limit 1;
  perform pg_temp.set_caller(v_operator);

  v_club := public.register_pilot_club(
    'Access Test Club', 'access-test-club', v_zone,
    null, null, null, null, '{}'::text[],
    jsonb_build_array(jsonb_build_object('name', 'Court 1', 'price_minor', 4000)),
    'external_link', '+961 70 555 444', true
  );

  -- The club list is the dashboard's way in. Reading memberships alone left an
  -- operator-entered club with no route to its own settings.
  perform pg_temp.assert_true(
    exists (
      select 1 from public.list_staff_clubs() as sc where sc.club_id = v_club
    ),
    'a club entered by ops must appear in the dashboard club list'
  );

  -- get_club_admin_detail is what the settings screen loads.
  v_detail := public.get_club_admin_detail(v_club);

  perform pg_temp.assert_true(
    (v_detail -> 'club' ->> 'club_id') = v_club::text
      and (v_detail -> 'club' ->> 'booking_phone') is not null,
    format('ops must be able to open the club settings, got %s', v_detail)
  );

  -- And change them, without holding a membership.
  perform public.update_club_booking_settings(v_club, 'external_link', '+961 71 222 333');
  perform public.update_club_profile(v_club, 'Access Test Club Renamed', null, null, null, null, '{}'::text[]);

  perform pg_temp.assert_true(
    (public.get_club_admin_detail(v_club) -> 'club' ->> 'name') = 'Access Test Club Renamed',
    'ops must be able to edit a club they entered'
  );

  perform pg_temp.assert_true(
    not exists (
      select 1 from public.club_memberships as cm where cm.club_id = v_club
    ),
    'none of this should require inventing a membership'
  );
end;
$$;

select pass('ops can see and edit the clubs they entered');

-- ---------------------------------------------------------------------------
-- A club member is authorised exactly as before
-- ---------------------------------------------------------------------------

do $$
declare
  v_club_admin uuid := '44444444-4444-4444-4444-444444444444';
  v_pilot uuid := 'bbbbbbbb-0001-0001-0001-000000000001';
  v_rows integer;
begin
  perform pg_temp.set_caller(v_club_admin);

  select count(*)::integer into v_rows from public.list_staff_clubs();

  perform pg_temp.assert_true(
    v_rows = 1
      and exists (
        select 1 from public.list_staff_clubs() as sc
        where sc.club_id = v_pilot and sc.role = 'admin'
      ),
    format('a club admin should still see only their own club, got %s rows', v_rows)
  );

  perform pg_temp.assert_true(
    (public.get_club_admin_detail(v_pilot) -> 'club' ->> 'club_id') = v_pilot::text,
    'a club admin keeps access to their own club'
  );
end;
$$;

select pass('club members are unaffected');

-- ---------------------------------------------------------------------------
-- Everyone else is still shut out
-- ---------------------------------------------------------------------------

do $$
declare
  v_player uuid := '11111111-1111-1111-1111-111111111111';
  v_pilot uuid := 'bbbbbbbb-0001-0001-0001-000000000001';
  v_read text;
  v_write text;
begin
  perform pg_temp.set_caller(v_player);

  perform pg_temp.assert_true(
    not exists (select 1 from public.list_staff_clubs()),
    'a player administers no clubs'
  );

  begin
    perform public.get_club_admin_detail(v_pilot);
    v_read := 'no error';
  exception when others then v_read := sqlerrm;
  end;

  begin
    perform public.update_club_booking_settings(v_pilot, 'external_link', '+961 70 000 000');
    v_write := 'no error';
  exception when others then v_write := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_read = 'Club admin access required' and v_write = 'Club admin access required',
    format('a player must not reach club administration, got read=%s write=%s', v_read, v_write)
  );
end;
$$;

select pass('players still cannot reach club administration');

select * from finish();

rollback;
