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
  p_format public.match_format,
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
      and lm.format = p_format
      and lm.status in ('draft', 'open', 'full', 'ready_to_book')
  loop
    begin
      perform public.cancel_match(v_existing_id, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;

  v_match_id := public.create_and_publish_match(
    p_format,
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
-- A self-arranged court confirms the match
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_booking_id uuid;
  v_hub public.match_hub_card;
  v_starts timestamptz := now() + interval '3 days';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, 'singles', v_starts);

  v_booking_id := public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001',
    v_starts,
    v_starts + interval '90 minutes',
    'Booked over WhatsApp'
  );

  perform pg_temp.assert_true(
    v_booking_id is not null,
    'confirming a self-arranged court should create a booking'
  );

  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'confirmed',
    'a self-arranged court should confirm the match'
  );
  perform pg_temp.assert_true(
    (v_hub.booking->>'status') = 'accepted',
    'the booking should be recorded as accepted'
  );
end;
$$;

select pass('a host can record a court they arranged themselves');

-- ---------------------------------------------------------------------------
-- Creator-only, and single-use
--
-- 041 briefly widened this to any accepted participant; 058 restored host-only
-- for Contact and Booked off-app.
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_outsider uuid := '77777777-7777-7777-7777-777777777777';
  v_match_id uuid;
  v_message text := '';
  v_starts timestamptz := now() + interval '4 days';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, 'singles', v_starts);

  perform pg_temp.set_caller(v_outsider);
  begin
    perform public.confirm_external_court(
      v_match_id,
      'cccccccc-0001-0001-0001-000000000001',
      v_starts,
      v_starts + interval '90 minutes',
      null
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%Only the creator%',
    format('someone outside the match must not confirm a court, got: %s', v_message)
  );

  -- Joiners cannot record a court either.
  v_message := '';
  perform pg_temp.set_caller(v_joiner);
  begin
    perform public.confirm_external_court(
      v_match_id,
      'cccccccc-0001-0001-0001-000000000001',
      v_starts,
      v_starts + interval '90 minutes',
      null
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%Only the creator%',
    format('a joiner must not confirm a court, got: %s', v_message)
  );

  perform pg_temp.set_caller(v_creator);
  perform public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001',
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  v_message := '';
  begin
    perform public.confirm_external_court(
      v_match_id,
      'cccccccc-0001-0001-0001-000000000001',
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
    'confirming a court twice must be refused'
  );
end;
$$;

select pass('external court confirmation is creator-only and single-use');

-- ---------------------------------------------------------------------------
-- Leaving while the club deliberates withdraws the request
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_starts timestamptz := now() + interval '5 days';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_joiner, 'singles', v_starts);

  perform pg_temp.set_caller(v_creator);
  perform public.request_match_booking(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001'
  );

  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'booking_pending',
    'the match should be awaiting the club'
  );

  -- Previously this raised match_not_leavable and trapped the participant.
  perform pg_temp.set_caller(v_joiner);
  perform public.leave_match(v_match_id);

  perform pg_temp.set_caller(v_creator);
  v_hub := public.get_match_hub(v_match_id);

  perform pg_temp.assert_true(
    v_hub.booking is null,
    'the pending request should be withdrawn when the roster breaks'
  );
  perform pg_temp.assert_true(
    v_hub.status = 'open',
    'the match should reopen for a replacement player'
  );
end;
$$;

select pass('a participant can leave while the club deliberates');

-- ---------------------------------------------------------------------------
-- Doubles keeps its court when one player withdraws
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_second uuid := '22222222-2222-2222-2222-222222222222';
  -- 6666 is blocked by 1111 in the seed, and 7777 is out of the skill range.
  v_third uuid := '12121212-1212-1212-1212-121212121212';
  v_fourth uuid := '14141414-1414-1414-1414-141414141414';
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_starts timestamptz := now() + interval '6 days';
begin
  v_match_id := pg_temp.ready_match(v_creator, v_second, 'doubles', v_starts);

  perform pg_temp.set_caller(v_third);
  perform public.join_match(v_match_id);
  perform pg_temp.set_caller(v_fourth);
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller(v_creator);
  perform public.confirm_external_court(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000002',
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  -- One of four drops out: the other three keep their court.
  perform pg_temp.set_caller(v_fourth);
  perform public.withdraw_from_booked_match(v_match_id, 'Injured');

  perform pg_temp.set_caller(v_creator);
  v_hub := public.get_match_hub(v_match_id);

  perform pg_temp.assert_true(
    v_hub.status = 'confirmed',
    'a doubles match should survive one withdrawal'
  );
  perform pg_temp.assert_true(
    (v_hub.booking->>'status') = 'accepted',
    'the court should be kept for the remaining players'
  );
  perform pg_temp.assert_true(
    v_hub.participant_count = 3,
    'the withdrawing player should be off the roster'
  );
end;
$$;

select pass('a doubles match keeps its court after one withdrawal');

select * from finish();
rollback;
