\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(7);

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

create or replace function pg_temp.clear_hosted(p_creator uuid)
returns void
language plpgsql
as $$
declare
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
end;
$$;

create or replace function pg_temp.publish_match_with_clubs(
  p_creator uuid,
  p_visibility public.match_visibility,
  p_club_ids uuid[],
  p_starts timestamptz
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
begin
  perform pg_temp.clear_hosted(p_creator);

  v_match_id := public.create_and_publish_match(
    'singles'::public.match_format,
    p_visibility,
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
    p_club_ids
  );

  return v_match_id;
end;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- A public listing must name a venue; a private one need not
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_message text;
  v_match_id uuid;
begin
  begin
    perform pg_temp.publish_match_with_clubs(
      v_creator,
      'public'::public.match_visibility,
      '{}'::uuid[],
      now() + interval '3 days'
    );
    v_message := 'no error';
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message = 'preferred_club_required',
    format('a public match with no club must be rejected, got %s', v_message)
  );

  -- Private matches are among people who already know where they play.
  v_match_id := pg_temp.publish_match_with_clubs(
    v_creator,
    'private'::public.match_visibility,
    '{}'::uuid[],
    now() + interval '3 days'
  );

  perform pg_temp.assert_true(
    v_match_id is not null,
    'a private match may fall back to zones with no club named'
  );
end;
$$;

select pass('a public match requires a club and a private match does not');

-- ---------------------------------------------------------------------------
-- The shortlist is capped and must reference real clubs
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_too_many text;
  v_unknown text;
begin
  begin
    perform pg_temp.publish_match_with_clubs(
      v_creator,
      'public'::public.match_visibility,
      array[
        'bbbbbbbb-0001-0001-0001-000000000001',
        'bbbbbbbb-0001-0001-0001-000000000002',
        '00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-0000000000a2'
      ]::uuid[],
      now() + interval '3 days'
    );
    v_too_many := 'no error';
  exception
    when others then
      v_too_many := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_too_many = 'At most three preferred clubs',
    format('four clubs must be rejected, got %s', v_too_many)
  );

  begin
    perform pg_temp.publish_match_with_clubs(
      v_creator,
      'public'::public.match_visibility,
      array['00000000-0000-0000-0000-0000000000ff']::uuid[],
      now() + interval '3 days'
    );
    v_unknown := 'no error';
  exception
    when others then
      v_unknown := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_unknown = 'Preferred club not found',
    format('an unknown club must be rejected, got %s', v_unknown)
  );
end;
$$;

select pass('the shortlist is capped at three and must reference active clubs');

-- ---------------------------------------------------------------------------
-- The hub carries the shortlist, including for someone who has not joined
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_stranger uuid := '33333333-3333-3333-3333-333333333333';
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_names text;
begin
  v_match_id := pg_temp.publish_match_with_clubs(
    v_creator,
    'public'::public.match_visibility,
    array[
      'bbbbbbbb-0001-0001-0001-000000000001',
      'bbbbbbbb-0001-0001-0001-000000000002'
    ]::uuid[],
    now() + interval '3 days'
  );

  v_hub := public.get_match_hub(v_match_id);

  perform pg_temp.assert_true(
    jsonb_array_length(v_hub.preferred_clubs) = 2,
    format('the hub should carry both clubs, got %s', v_hub.preferred_clubs)
  );

  select string_agg(entry ->> 'name', ',' order by entry ->> 'name')
  into v_names
  from jsonb_array_elements(v_hub.preferred_clubs) as entry;

  perform pg_temp.assert_true(
    v_names = 'Pilot Tennis Club,WhatsApp Tennis Club',
    format('the hub should name the clubs, got %s', v_names)
  );

  -- The whole point: this is the surface someone reads before deciding to join.
  perform pg_temp.set_caller(v_stranger);
  v_hub := public.get_match_hub(v_match_id);

  perform pg_temp.assert_true(
    v_hub.viewer_status is null
      and jsonb_array_length(v_hub.preferred_clubs) = 2,
    'a non-participant must see the clubs before joining a public match'
  );
end;
$$;

select pass('the hub exposes the shortlist to participants and prospective joiners');

-- ---------------------------------------------------------------------------
-- Discovery carries the shortlist too
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  -- The searcher needs a skill band overlapping the match (33333333 has no
  -- player_profile, so skill_band_rank(null) filters every row out) and must
  -- not be blocked by the creator (the seed has 11111111 blocking 66666666).
  v_searcher uuid := '14141414-1414-1414-1414-141414141414';
  v_match_id uuid;
  v_clubs jsonb;
begin
  v_match_id := pg_temp.publish_match_with_clubs(
    v_creator,
    'public'::public.match_visibility,
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[],
    now() + interval '3 days'
  );

  perform pg_temp.set_caller(v_searcher);

  select card.preferred_clubs
  into v_clubs
  from public.discover_open_matches(
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[]
  ) as card
  where card.match_id = v_match_id;

  perform pg_temp.assert_true(
    v_clubs is not null and jsonb_array_length(v_clubs) = 1,
    format('the discover card should carry the shortlist, got %s', v_clubs)
  );
end;
$$;

select pass('discover cards carry the shortlist');

-- ---------------------------------------------------------------------------
-- A court at a shortlisted club is not flagged
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_court uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_match_id uuid;
  v_starts timestamptz := now() + interval '8 days';
  v_off_list boolean;
begin
  v_match_id := pg_temp.publish_match_with_clubs(
    v_creator,
    'public'::public.match_visibility,
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[],
    v_starts
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match_id);

  -- 058 made securing a court host-only, and joining above left the joiner as
  -- the caller.
  perform pg_temp.set_caller(v_creator);

  perform public.confirm_external_court(
    v_match_id,
    v_court,
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  set local role postgres;
  select (ae.metadata ->> 'off_preferred_list')::boolean
  into v_off_list
  from public.audit_events as ae
  where ae.entity_id = v_match_id
    and ae.action = 'court_arranged_externally'
  order by ae.created_at desc
  limit 1;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_off_list = false,
    format('a court at a shortlisted club must not be flagged, got %s', v_off_list)
  );
end;
$$;

select pass('a court at an agreed club is not flagged');

-- ---------------------------------------------------------------------------
-- A court somewhere else is flagged, and still confirms the match
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_other_court uuid := 'cccccccc-0001-0001-0001-000000000003';
  v_match_id uuid;
  v_starts timestamptz := now() + interval '9 days';
  v_off_list boolean;
  v_hub public.match_hub_card;
  v_body text;
begin
  -- Shortlist is the Pilot club; the court booked is at the WhatsApp club.
  v_match_id := pg_temp.publish_match_with_clubs(
    v_creator,
    'public'::public.match_visibility,
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[],
    v_starts
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match_id);

  -- 058 made securing a court host-only, and joining above left the joiner as
  -- the caller.
  perform pg_temp.set_caller(v_creator);

  perform public.confirm_external_court(
    v_match_id,
    v_other_court,
    v_starts,
    v_starts + interval '90 minutes',
    null
  );

  v_hub := public.get_match_hub(v_match_id);

  -- Blocking this is what strands a match when the agreed club is full, so it
  -- must still confirm.
  perform pg_temp.assert_true(
    v_hub.status = 'confirmed',
    format('an off-list court must still confirm the match, got %s', v_hub.status)
  );

  set local role postgres;
  select (ae.metadata ->> 'off_preferred_list')::boolean
  into v_off_list
  from public.audit_events as ae
  where ae.entity_id = v_match_id
    and ae.action = 'court_arranged_externally'
  order by ae.created_at desc
  limit 1;

  select n.payload ->> 'body'
  into v_body
  from public.notifications as n
  where n.entity_id = v_match_id
    and n.kind = 'match_court_confirmed'
  order by n.created_at desc
  limit 1;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_off_list = true,
    format('an off-list court must be flagged, got %s', v_off_list)
  );

  -- The club name is the thing the other players could not see before.
  perform pg_temp.assert_true(
    v_body like '%WhatsApp Tennis Club%' and v_body like '%not on the list%',
    format('the notice must name the club and say it was off-list, got %s', v_body)
  );
end;
$$;

select pass('an off-list court is flagged, announced, and still confirms');

-- ---------------------------------------------------------------------------
-- The table itself stays closed to clients
-- ---------------------------------------------------------------------------

do $$
declare
  v_message text;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  begin
    perform 1 from public.match_preferred_clubs limit 1;
    v_message := 'no error';
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%permission denied%',
    format('match_preferred_clubs must be RPC-only, got %s', v_message)
  );
end;
$$;

select pass('match_preferred_clubs is not readable by authenticated clients');

select * from finish();

rollback;
