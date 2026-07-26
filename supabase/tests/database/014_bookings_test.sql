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
      perform public.cancel_match(v_existing_id);
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
  perform public.cast_match_time_vote(v_match_id, v_option_id, 'yes'::public.vote_value);

  perform pg_temp.set_caller(p_joiner_id);
  perform public.cast_match_time_vote(v_match_id, v_option_id, 'yes'::public.vote_value);

  perform pg_temp.set_caller(p_creator_id);
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'ready_to_book',
    'match should be ready_to_book after unanimous vote'
  );
  perform pg_temp.assert_true(
    v_hub.next_action = 'request_court',
    'creator next action should be request_court'
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
  -- Non-creator cannot request
  v_match_id := pg_temp.create_ready_match(
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  v_failed := false;
  begin
    perform public.request_match_booking(
      v_match_id,
      'cccccccc-0001-0001-0001-000000000001'
    );
  exception
    when others then
      v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'non-creator should not request booking');

  -- Creator requests booking
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_booking_id := public.request_match_booking(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001'
  );

  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(v_hub.status = 'booking_pending', 'match becomes booking_pending');
  perform pg_temp.assert_true(v_hub.next_action = 'awaiting_club', 'hub awaiting club');
  perform pg_temp.assert_true(v_hub.booking is not null, 'hub includes booking');
  perform pg_temp.assert_true(
    (v_hub.booking->>'status') = 'requested',
    'booking status requested'
  );

  -- Player cannot accept
  v_failed := false;
  begin
    perform public.accept_booking(v_booking_id);
  exception
    when others then
      v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'player cannot accept booking');

  -- Staff accept
  perform pg_temp.set_caller('33333333-3333-3333-3333-333333333333');
  perform public.accept_booking(v_booking_id);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(v_hub.status = 'confirmed', 'match confirmed after accept');
  perform pg_temp.assert_true(
    (v_hub.booking->>'status') = 'accepted',
    'booking accepted'
  );
  perform pg_temp.assert_true(v_hub.next_action = 'pay_at_club', 'hub pay at club');

  -- Reject path
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
  perform public.reject_booking(v_booking_id, 'Court closed');

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'ready_to_book',
    'reject reopens ready_to_book'
  );

  -- Alternative path
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
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.next_action = 'review_alternative',
    'creator reviews alternative'
  );

  perform public.respond_booking_alternative(v_booking_id, true);
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'confirmed',
    'accept alternative confirms match'
  );
  perform pg_temp.assert_true(
    (v_hub.booking->>'status') = 'accepted',
    'alternative accepted'
  );

  -- Favourite clubs
  perform public.set_club_favorite('bbbbbbbb-0001-0001-0001-000000000001', true);
  perform pg_temp.assert_true(
    exists (
      select 1
      from public.list_clubs_directory(null) as d
      where d.club_id = 'bbbbbbbb-0001-0001-0001-000000000001'
        and d.is_favorite = true
    ),
    'favourite club listed'
  );
end;
$$;

select pass('milestone 5 bookings rpc suite');
select * from finish();
rollback;
