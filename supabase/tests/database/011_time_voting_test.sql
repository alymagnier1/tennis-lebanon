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

create or replace function pg_temp.create_test_match(
  p_creator_id uuid,
  p_format public.match_format default 'singles',
  p_visibility public.match_visibility default 'public',
  p_requires_creator_approval boolean default false
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_existing_id uuid;
begin
  perform pg_temp.set_caller(p_creator_id);

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = p_format
      and lm.status in ('open', 'full', 'ready_to_book')
  loop
    perform public.cancel_match(v_existing_id, 'test cleanup');
  end loop;

  select public.create_and_publish_match(
    p_format,
    p_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    p_requires_creator_approval,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      ),
      jsonb_build_object(
        'starts_at', (now() + interval '4 days')::text,
        'ends_at', (now() + interval '4 days 90 minutes')::text
      )
    ),
    -- Voting is the subject of this file, so it opts into flexible timing.
    'flexible'
  )
  into v_match_id;

  return v_match_id;
end;
$$;

set local role authenticated;

do $$
declare
  v_match_id uuid;
  v_option_a uuid;
  v_option_b uuid;
  v_hub public.match_hub_card;
begin
  v_match_id := pg_temp.create_test_match(
    '11111111-1111-1111-1111-111111111111',
    'singles',
    'public',
    false
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);

  v_option_a := (v_hub.proposed_times->0->>'id')::uuid;
  v_option_b := (v_hub.proposed_times->1->>'id')::uuid;

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  perform public.cast_match_time_vote(v_match_id, v_option_a, 'yes'::public.vote_value);

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  perform public.cast_match_time_vote(v_match_id, v_option_b, 'yes'::public.vote_value);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);

  if v_hub.status = 'ready_to_book' then
    raise exception 'should not be ready_to_book without unanimous yes on one slot';
  end if;

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  perform public.cast_match_time_vote(v_match_id, v_option_a, 'yes'::public.vote_value);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);

  if v_hub.status <> 'ready_to_book' or v_hub.selected_time_option_id <> v_option_a then
    raise exception 'expected ready_to_book with unanimous yes on option A';
  end if;

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);

  if v_hub.next_action <> 'request_court' then
    raise exception 'expected request_court next action for creator, got %', v_hub.next_action;
  end if;

  perform public.cast_match_time_vote(v_match_id, v_option_a, 'no'::public.vote_value);

  v_hub := public.get_match_hub(v_match_id);

  if v_hub.status <> 'full' or v_hub.selected_time_option_id is not null then
    raise exception 'expected revert to full when agreement lost';
  end if;

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  perform public.withdraw_match_time_option(v_option_b);

  v_hub := public.get_match_hub(v_match_id);

  if jsonb_array_length(v_hub.proposed_times) <> 1 then
    raise exception 'expected one active time option after withdraw';
  end if;

  perform public.add_match_time_option(
    v_match_id,
    now() + interval '5 days',
    now() + interval '5 days 90 minutes'
  );

  v_hub := public.get_match_hub(v_match_id);

  if jsonb_array_length(v_hub.proposed_times) <> 2 then
    raise exception 'expected two active time options after withdraw and add';
  end if;
end;
$$;

select pg_temp.assert_true(true, 'time voting transitions and hub metadata work');

select pass('Milestone 4 time voting passed');
select * from finish();

rollback;
