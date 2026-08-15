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

create or replace function pg_temp.ready_match(
  p_creator uuid,
  p_joiner uuid,
  p_starts timestamptz
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_existing_id uuid;
begin
  perform pg_temp.set_caller(p_creator);

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft', 'open', 'full', 'ready_to_book', 'booking_pending')
  loop
    begin
      perform public.cancel_match(v_existing_id, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;

  v_match_id := public.create_and_publish_match(
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
        'starts_at', p_starts::text,
        'ends_at', (p_starts + interval '90 minutes')::text
      )
    ),
    'fixed',
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  perform pg_temp.set_caller(p_joiner);
  perform public.join_match(v_match_id);
  perform pg_temp.set_caller(p_creator);

  return v_match_id;
end;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- The stranding case: the club never replied, so the host rang them directly
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_match_id uuid;
  v_pending_booking_id uuid;
  v_external_booking_id uuid;
  v_hub public.match_hub_card;
  v_pending_status public.booking_status;
  v_starts timestamptz := now() + interval '6 days';
  v_joiner_message text := '';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, v_starts);

  perform pg_temp.set_caller(v_creator);
  v_pending_booking_id := public.request_match_booking(v_match_id, v_court);

  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'booking_pending',
    format('expected booking_pending before the fix applies, got %s', v_hub.status)
  );

  -- Joiners cannot record an off-app court (host-only since 058).
  perform pg_temp.set_caller(v_joiner);
  begin
    perform public.confirm_external_court(
      v_match_id,
      v_court,
      v_starts,
      v_starts + interval '90 minutes',
      'Booked by phone'
    );
  exception
    when others then
      v_joiner_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_joiner_message like '%Only the creator%',
    format('joiner must be refused, got: %s', v_joiner_message)
  );

  perform pg_temp.set_caller(v_creator);
  v_external_booking_id := public.confirm_external_court(
    v_match_id,
    v_court,
    v_starts,
    v_starts + interval '90 minutes',
    'Booked by phone'
  );

  perform pg_temp.assert_true(
    v_external_booking_id is not null,
    'the host must be able to record a court while the club is still deciding'
  );

  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'confirmed',
    format('the match should reach confirmed, got %s', v_hub.status)
  );

  -- The superseded request must be withdrawn in the same transaction, not left
  -- outstanding for the club to accept later. No RPC exposes a superseded
  -- booking, so read it directly; `authenticated` has no grant on bookings.
  set local role postgres;
  select b.status
  into v_pending_status
  from public.bookings as b
  where b.id = v_pending_booking_id;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_pending_status = 'cancelled',
    format('the pending club request should be cancelled, got %s', v_pending_status)
  );
end;
$$;

select pass('joiners cannot record an off-app court while a club request is pending');
select pass('the host can record an off-app court while a club request is pending');

-- ---------------------------------------------------------------------------
-- A club must not be able to act on the request that was superseded
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_staff uuid := '33333333-3333-3333-3333-333333333333';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_match_id uuid;
  v_pending_booking_id uuid;
  v_message text := '';
  v_starts timestamptz := now() + interval '7 days';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, v_starts);

  perform pg_temp.set_caller(v_creator);
  v_pending_booking_id := public.request_match_booking(v_match_id, v_court);

  perform public.confirm_external_court(
    v_match_id,
    v_court,
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  -- Club staff acting on the stale request must be refused: accept_booking
  -- requires status 'requested', and the withdrawal moved it to 'cancelled'.
  -- Without that, staff could confirm a court the players already replaced and
  -- turn up expecting them.
  perform pg_temp.set_caller(v_staff);
  begin
    perform public.accept_booking(v_pending_booking_id);
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message <> '',
    'the club must not be able to accept a request that was already superseded'
  );
end;
$$;

select pass('a superseded club request cannot be accepted afterwards');

-- ---------------------------------------------------------------------------
-- An already-accepted court is not something to supersede
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_match_id uuid;
  v_message text := '';
  v_starts timestamptz := now() + interval '8 days';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, v_starts);

  perform pg_temp.set_caller(v_creator);
  perform public.confirm_external_court(
    v_match_id,
    v_court,
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  begin
    perform public.confirm_external_court(
      v_match_id,
      v_court,
      v_starts,
      v_starts + interval '90 minutes',
      null
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message <> '',
    'a match that already holds an accepted court must not take another'
  );
end;
$$;

select pass('an accepted booking is never silently replaced');

select * from finish();

rollback;
