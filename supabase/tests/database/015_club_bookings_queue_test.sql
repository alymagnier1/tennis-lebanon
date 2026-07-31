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

create or replace function pg_temp.create_ready_match(p_creator_id uuid, p_joiner_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_existing_id uuid;
  v_hub public.match_hub_card;
  v_option_id uuid;
begin
  perform pg_temp.set_caller(p_creator_id);

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = 'singles'
      and lm.status in ('draft', 'open', 'full', 'ready_to_book', 'booking_pending')
  loop
    begin
      perform public.cancel_match(v_existing_id, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;

  select public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      )
    )
  )
  into v_match_id;

  perform pg_temp.set_caller(p_joiner_id);
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller(p_creator_id);
  v_hub := public.get_match_hub(v_match_id);
  v_option_id := (v_hub.proposed_times->0->>'id')::uuid;

  perform pg_temp.set_caller(p_joiner_id);

  return v_match_id;
end;
$$;

set local role authenticated;

do $$
declare
  v_match_id uuid;
  v_booking_id uuid;
  v_queue_count integer;
  v_detail jsonb;
  v_failed boolean;
begin
  v_match_id := pg_temp.create_ready_match(
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_booking_id := public.request_match_booking(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001'
  );

  -- Player has no staff clubs
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  select count(*)::integer
  into v_queue_count
  from public.list_staff_clubs();

  if v_queue_count <> 0 then
    raise exception 'player should have no staff clubs';
  end if;

  -- Player cannot list club queue
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_failed := false;
  begin
    perform 1
    from public.list_club_booking_requests(
      'bbbbbbbb-0001-0001-0001-000000000001',
      array['requested']::public.booking_status[]
    );
    v_failed := true;
  exception
    when others then
      null;
  end;
  if v_failed then
    raise exception 'player should not list club booking queue';
  end if;

  -- Club staff sees queue
  perform pg_temp.set_caller('33333333-3333-3333-3333-333333333333');
  select count(*)::integer
  into v_queue_count
  from public.list_club_booking_requests(
    'bbbbbbbb-0001-0001-0001-000000000001',
    array['requested']::public.booking_status[]
  )
  where booking_id = v_booking_id;

  if v_queue_count <> 1 then
    raise exception 'staff queue should include requested booking';
  end if;

  v_detail := public.get_club_booking_detail(v_booking_id);
  if (v_detail->'booking'->>'booking_id')::uuid <> v_booking_id then
    raise exception 'booking detail mismatch';
  end if;

  -- Other club staff (none seeded) / player cannot access detail
  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  v_failed := false;
  begin
    perform public.get_club_booking_detail(v_booking_id);
    v_failed := true;
  exception
    when others then
      null;
  end;
  if v_failed then
    raise exception 'non-staff should not read booking detail';
  end if;

  perform pg_temp.set_caller('33333333-3333-3333-3333-333333333333');
  perform public.accept_booking(v_booking_id);

  select count(*)::integer
  into v_queue_count
  from public.list_club_booking_requests(
    'bbbbbbbb-0001-0001-0001-000000000001',
    array['requested']::public.booking_status[]
  )
  where booking_id = v_booking_id;

  if v_queue_count <> 0 then
    raise exception 'accepted booking should leave requested queue';
  end if;
end;
$$;

select pass('club booking queue RPCs');

rollback;
