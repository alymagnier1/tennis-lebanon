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

-- Seeded user 5555 holds the platform admin role.
create or replace function pg_temp.operator_club(
  p_name text,
  p_slug text,
  p_phone text default '+961 70 111 222'
)
returns uuid
language plpgsql
as $$
declare
  v_zone_id uuid;
begin
  select z.id into v_zone_id from public.zones as z where z.is_active limit 1;

  return public.register_pilot_club(
    p_name,
    p_slug,
    v_zone_id,
    'Entered by ops for the WhatsApp-only pilot',
    'Beirut area',
    null,
    null,
    array['parking']::text[],
    jsonb_build_array(
      jsonb_build_object('name', 'Court 1', 'surface', 'clay', 'price_minor', 4000)
    ),
    'external_link',
    p_phone,
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- One account can enter every pilot club
-- ---------------------------------------------------------------------------

do $$
declare
  v_operator uuid := '55555555-5555-5555-5555-555555555555';
  v_first uuid;
  v_second uuid;
begin
  perform pg_temp.set_caller(v_operator);

  v_first := pg_temp.operator_club('Ops Club One', 'ops-club-one');
  -- The one-club-per-admin rule is what stopped this before.
  v_second := pg_temp.operator_club('Ops Club Two', 'ops-club-two');

  perform pg_temp.assert_true(
    v_first is not null and v_second is not null and v_first <> v_second,
    'an operator must be able to enter more than one club'
  );

  -- An operator is entering somebody else's club and should not hold its keys.
  perform pg_temp.assert_true(
    not exists (
      select 1
      from public.club_memberships as cm
      where cm.club_id in (v_first, v_second)
    ),
    'entering a club on its behalf must not create a membership'
  );
end;
$$;

select pass('one operator account can enter many clubs and admins none of them');

-- ---------------------------------------------------------------------------
-- The club is listed and bookable straight away
-- ---------------------------------------------------------------------------

do $$
declare
  v_operator uuid := '55555555-5555-5555-5555-555555555555';
  v_club uuid;
  v_detail jsonb;
begin
  perform pg_temp.set_caller(v_operator);
  v_club := pg_temp.operator_club('Ops Club Three', 'ops-club-three');

  -- No approval queue: the operator is the approver.
  perform pg_temp.assert_true(
    not exists (
      select 1 from public.list_pending_clubs() as pc where pc.club_id = v_club
    ),
    'an operator entry should not wait in the approval queue'
  );

  perform pg_temp.assert_true(
    exists (
      select 1 from public.list_clubs_directory(null) as d where d.club_id = v_club
    ),
    'the club should be visible to players immediately'
  );

  v_detail := public.get_club_detail(v_club);

  perform pg_temp.assert_true(
    (v_detail ->> 'booking_mode') = 'external_link'
      and (v_detail ->> 'whatsapp_booking_available')::boolean,
    format('the club should be WhatsApp-bookable, got %s', v_detail)
  );
end;
$$;

select pass('an operator entry is listed and WhatsApp-bookable at once');

-- ---------------------------------------------------------------------------
-- A WhatsApp club with no number would be listed but unbookable
-- ---------------------------------------------------------------------------

do $$
declare
  v_operator uuid := '55555555-5555-5555-5555-555555555555';
  v_missing text;
  v_not_operator text;
  v_zone_id uuid;
begin
  perform pg_temp.set_caller(v_operator);

  begin
    perform pg_temp.operator_club('Ops Club Four', 'ops-club-four', null);
    v_missing := 'no error';
  exception
    when others then
      v_missing := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_missing = 'WhatsApp booking phone is required',
    format('a WhatsApp club needs a number, got %s', v_missing)
  );

  -- Claiming to act as an operator is checked, not taken on trust.
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  select z.id into v_zone_id from public.zones as z where z.is_active limit 1;

  begin
    perform public.register_pilot_club(
      'Not An Operator', 'not-an-operator', v_zone_id, null, null, null, null,
      '{}'::text[],
      jsonb_build_array(jsonb_build_object('name', 'Court 1')),
      'external_link', '+961 70 333 444', true
    );
    v_not_operator := 'no error';
  exception
    when others then
      v_not_operator := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_not_operator = 'Platform operator access required',
    format('only an operator may enter a club on its behalf, got %s', v_not_operator)
  );
end;
$$;

select pass('the operator path is guarded and needs a working number');

-- ---------------------------------------------------------------------------
-- Fixing a number later must not require being the club's admin
-- ---------------------------------------------------------------------------

do $$
declare
  v_operator uuid := '55555555-5555-5555-5555-555555555555';
  v_outsider uuid := '11111111-1111-1111-1111-111111111111';
  v_club uuid;
  v_refused text;
begin
  perform pg_temp.set_caller(v_operator);
  v_club := pg_temp.operator_club('Ops Club Five', 'ops-club-five');

  -- Nobody admins this club, so without the operator path the number could
  -- never be corrected.
  perform public.update_club_booking_settings(v_club, 'external_link', '+961 71 999 888');

  perform pg_temp.assert_true(
    (public.get_club_detail(v_club) ->> 'whatsapp_booking_available')::boolean,
    'an operator should be able to correct a club number'
  );

  perform pg_temp.set_caller(v_outsider);
  begin
    perform public.update_club_booking_settings(v_club, 'external_link', '+961 71 000 111');
    v_refused := 'no error';
  exception
    when others then
      v_refused := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_refused <> 'no error',
    'a player must not be able to change a club booking number'
  );
end;
$$;

select pass('operators can correct a club number, players cannot');

select * from finish();

rollback;
