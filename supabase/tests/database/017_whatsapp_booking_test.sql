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
  v_club_id uuid := 'bbbbbbbb-0001-0001-0001-000000000001';
  v_detail jsonb;
  v_link jsonb;
  v_failed boolean;
begin
  perform pg_temp.set_caller('44444444-4444-4444-4444-444444444444');

  perform public.update_club_booking_settings(
    v_club_id,
    'external_link',
    '+961 70 123 456'
  );

  v_detail := public.get_club_admin_detail(v_club_id);
  if (v_detail->'club'->>'booking_mode') <> 'external_link' then
    raise exception 'booking mode not updated';
  end if;

  if (v_detail->'club'->>'booking_phone') is null then
    raise exception 'booking phone not saved';
  end if;

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  v_detail := public.get_club_detail(v_club_id);
  if coalesce((v_detail->>'whatsapp_booking_available')::boolean, false) is not true then
    raise exception 'whatsapp_booking_available should be true for players';
  end if;

  if (v_detail ? 'booking_phone') then
    raise exception 'player club detail must not expose booking_phone';
  end if;

  v_link := public.get_club_whatsapp_booking_link(v_club_id);
  if (v_link->>'phone_digits') <> '96170123456' then
    raise exception 'unexpected whatsapp phone: %', v_link->>'phone_digits';
  end if;

  if (v_link->>'message') not like 'Hello, I would like to book a court at Pilot Tennis Club%' then
    raise exception 'unexpected whatsapp message: %', v_link->>'message';
  end if;

  perform pg_temp.set_caller('44444444-4444-4444-4444-444444444444');
  perform public.update_club_booking_settings(v_club_id, 'manual_request', null);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_failed := false;
  begin
    perform public.get_club_whatsapp_booking_link(v_club_id);
    v_failed := true;
  exception
    when others then
      null;
  end;
  if v_failed then
    raise exception 'whatsapp link should fail when club is manual_request';
  end if;
end;
$$;

select pass('whatsapp booking settings and link RPCs');

rollback;
