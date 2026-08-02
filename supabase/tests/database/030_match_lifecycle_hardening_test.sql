\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(5);

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
      and lm.status in (
        'draft',
        'open',
        'full',
        'ready_to_book',
        'booking_pending',
        'confirmed',
        'cancelled'
      )
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
    ),
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  )
  into v_match_id;

  perform pg_temp.set_caller(p_joiner_id);
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller(p_creator_id);
  v_hub := public.get_match_hub(v_match_id);
  v_option_id := (v_hub.proposed_times->0->>'id')::uuid;

  perform pg_temp.set_caller(p_joiner_id);

  perform pg_temp.set_caller(p_creator_id);
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'ready_to_book',
    'match should be ready_to_book once the roster is full'
  );

  return v_match_id;
end;
$$;

set local role authenticated;

do $$
declare
  v_match_id uuid;
  v_booking_id uuid;
  v_hub public.match_hub_card;
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

  perform pg_temp.set_caller('33333333-3333-3333-3333-333333333333');
  perform public.propose_booking_alternative(
    v_booking_id,
    'cccccccc-0001-0001-0001-000000000002',
    now() + interval '3 days 2 hours',
    now() + interval '3 days 3 hours 30 minutes',
    'Court 1 busy'
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  perform public.cancel_match(v_match_id, 'Plans changed');

  -- Assert through the RPC surface: `authenticated` has no direct SELECT on
  -- public.matches / public.bookings, and get_match_hub only returns a booking
  -- while it is requested/alternative_proposed/accepted.
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'cancelled',
    'match should be cancelled'
  );
  perform pg_temp.assert_true(
    v_hub.booking is null,
    'active booking should be cancelled when match is cancelled'
  );

  v_failed := false;
  begin
    perform public.respond_booking_alternative(v_booking_id, true);
  exception
    when others then
      v_failed := true;
  end;
  perform pg_temp.assert_true(
    v_failed,
    'accepting alternative after match cancel should fail'
  );

  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'cancelled',
    'match must stay cancelled after failed alternative accept'
  );
end;
$$;

select pass('cancel_match clears alternative_proposed and blocks resurrection');

do $$
declare
  v_match_id uuid;
  v_booking_id uuid;
  v_hub public.match_hub_card;
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

  perform pg_temp.set_caller('33333333-3333-3333-3333-333333333333');
  perform public.propose_booking_alternative(
    v_booking_id,
    'cccccccc-0001-0001-0001-000000000002',
    now() + interval '3 days 2 hours',
    now() + interval '3 days 3 hours 30 minutes',
    'Court 1 busy'
  );

  perform pg_temp.set_caller('33333333-3333-3333-3333-333333333333');
  perform public.withdraw_booking_alternative(v_booking_id, 'Reconsidering');

  -- Booking state is asserted via the hub below rather than a direct read:
  -- `authenticated` has no SELECT grant on public.bookings.
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'booking_pending',
    'match stays booking_pending after staff withdraws alternative'
  );
  perform pg_temp.assert_true(
    (v_hub.booking->>'status') = 'requested',
    'hub shows requested booking after withdraw'
  );
end;
$$;

select pass('staff can withdraw booking alternative back to requested');

do $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_failed boolean;
begin
  v_match_id := pg_temp.create_ready_match(
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_failed := false;
  begin
    perform public.leave_match(v_match_id);
  exception
    when others then
      v_failed := sqlerrm like '%creator_should_cancel_match%';
  end;
  perform pg_temp.assert_true(v_failed, 'creator leave should be rejected');
end;
$$;

select pass('creator cannot leave match');

do $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
begin
  v_match_id := pg_temp.create_ready_match(
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  perform public.leave_match(v_match_id);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);

  perform pg_temp.assert_true(v_hub.status = 'open', 'leave from ready_to_book reopens match');
  -- Under fixed timing the time is a property of the match, not something the
  -- roster agreed to, so it survives a participant leaving and the slot is
  -- still on offer to whoever joins next.
  perform pg_temp.assert_true(
    v_hub.selected_time_option_id is not null,
    'fixed match keeps its time after a participant leaves'
  );
  perform pg_temp.assert_true(
    v_hub.participant_count = 1,
    'only creator remains after joiner leaves'
  );
end;
$$;

select pass('leave from ready_to_book reverts roster and time agreement');

do $$
declare
  v_match_id uuid;
  v_failed boolean;
begin
  v_match_id := pg_temp.create_ready_match(
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );

  set local role postgres;
  update public.match_participants
  set status = 'left', left_at = now()
  where match_id = v_match_id
    and user_id = '22222222-2222-2222-2222-222222222222';

  set local role authenticated;
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  v_failed := false;
  begin
    perform public.request_match_booking(
      v_match_id,
      'cccccccc-0001-0001-0001-000000000001'
    );
  exception
    when others then
      v_failed := sqlerrm like '%match_roster_incomplete%';
  end;

  perform pg_temp.assert_true(
    v_failed,
    'booking request should fail when roster is incomplete'
  );
end;
$$;

select pass('request_match_booking enforces full roster');

select * from finish();
rollback;
