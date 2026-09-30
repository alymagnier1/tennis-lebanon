\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(2);

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

create or replace function pg_temp.publish_doubles(
  p_creator uuid,
  p_starts timestamptz
)
returns uuid
language plpgsql
as $$
begin
  perform pg_temp.clear_hosted(p_creator);

  return public.create_and_publish_match(
    'doubles'::public.match_format,
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
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );
end;
$$;

create or replace function pg_temp.discover_card(
  p_viewer uuid,
  p_match_id uuid
)
returns public.discover_open_match_card
language plpgsql
as $$
declare
  v_card public.discover_open_match_card;
begin
  perform pg_temp.set_caller(p_viewer);

  select card.*
  into v_card
  from public.discover_open_matches(
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[]
  ) as card
  where card.match_id = p_match_id;

  return v_card;
end;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Accepted players, host first, with public card fields only
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  -- Overlapping skill band, not blocked by the creator (see 045's test).
  v_searcher uuid := '14141414-1414-1414-1414-141414141414';
  v_match_id uuid;
  v_card public.discover_open_match_card;
  v_creator_name text;
  v_joiner_name text;
begin
  v_match_id := pg_temp.publish_doubles(
    v_creator,
    now() + interval '11 days 3 hours'
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match_id);

  v_card := pg_temp.discover_card(v_searcher, v_match_id);

  set local role postgres;
  select p.display_name into v_creator_name
  from public.profiles as p where p.id = v_creator;
  select p.display_name into v_joiner_name
  from public.profiles as p where p.id = v_joiner;
  set local role authenticated;

  perform pg_temp.assert_true(
    v_card.match_id is not null,
    'the searcher should see the doubles listing'
  );

  perform pg_temp.assert_true(
    jsonb_array_length(v_card.participants) = 2
      and v_card.participant_count = 2,
    format('the roster should list both accepted players, got %s', v_card.participants)
  );

  perform pg_temp.assert_true(
    v_card.participants -> 0 ->> 'display_name' = v_creator_name
      and v_card.participants -> 1 ->> 'display_name' = v_joiner_name,
    format('the host should come first, got %s', v_card.participants)
  );

  -- Nothing beyond what the public player card already shows.
  perform pg_temp.assert_true(
    (
      select bool_and(
        (select array_agg(key order by key) from jsonb_object_keys(entry) as key)
          = array['avatar_path', 'display_name']
      )
      from jsonb_array_elements(v_card.participants) as entry
    ),
    format('roster entries must carry only name and avatar, got %s', v_card.participants)
  );
end;
$$;

select pass('discover cards list accepted players, host first, name and avatar only');

-- ---------------------------------------------------------------------------
-- A player blocked with the viewer is left out; the seat count stays true
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_searcher uuid := '14141414-1414-1414-1414-141414141414';
  v_match_id uuid;
  v_card public.discover_open_match_card;
begin
  v_match_id := pg_temp.publish_doubles(
    v_creator,
    now() + interval '12 days 3 hours'
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match_id);

  set local role postgres;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_searcher, v_joiner);
  set local role authenticated;

  v_card := pg_temp.discover_card(v_searcher, v_match_id);

  perform pg_temp.assert_true(
    v_card.match_id is null
      or (
        jsonb_array_length(v_card.participants) = 1
        and v_card.participant_count = 2
      ),
    format('a blocked player must not appear in the roster, got %s', v_card.participants)
  );
end;
$$;

select pass('a player blocked with the viewer is left out of the roster');

select * from finish();

rollback;
