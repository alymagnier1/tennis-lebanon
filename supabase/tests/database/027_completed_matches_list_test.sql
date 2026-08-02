\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(2);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

create or replace function pg_temp.create_completed_match(
  p_creator_id uuid,
  p_joiner_id uuid,
  p_past_hours integer default 2
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_option_id uuid;
  v_booking_id uuid;
  v_start timestamptz := now() - make_interval(hours => p_past_hours);
  v_end timestamptz := v_start + interval '30 minutes';
begin
  perform pg_temp.set_caller(p_creator_id);

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
        'starts_at', (now() + interval '2 days')::text,
        'ends_at', (now() + interval '2 days 90 minutes')::text
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
  v_booking_id := public.request_match_booking(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001'
  );

  perform pg_temp.set_caller('33333333-3333-3333-3333-333333333333');
  perform public.accept_booking(v_booking_id);

  set local role postgres;
  update public.bookings
  set
    starts_at = v_start,
    ends_at = v_end
  where id = v_booking_id;

  perform public.start_in_progress_matches();
  set local role authenticated;

  perform pg_temp.set_caller(p_creator_id);
  perform public.submit_match_result(
    v_match_id,
    jsonb_build_object('sets', jsonb_build_array(jsonb_build_array(6, 4), jsonb_build_array(6, 3))),
    p_creator_id
  );

  perform pg_temp.set_caller(p_joiner_id);
  perform public.confirm_match_result(v_match_id);

  return v_match_id;
end;
$$;

set local role postgres;

do $$
declare
  v_existing_id uuid;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft', 'open', 'full', 'ready_to_book', 'booking_pending', 'confirmed', 'in_progress')
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

set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.list_my_completed_matches() as row
  ),
  0,
  'completed list starts empty for creator before any finished match'
);

set local role postgres;

do $$
declare
  v_match_id uuid;
begin
  v_match_id := pg_temp.create_completed_match(
    '11111111-1111-1111-1111-111111111111',
    '88888888-8888-8888-8888-888888888888',
    3
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  if not exists (
    select 1
    from public.list_my_completed_matches() as row
    where row.match_id = v_match_id
      and row.result_status = 'confirmed'
      and row.viewer_won is true
      and row.opponent_names is not null
      and row.played_at is not null
      and row.club_name is not null
  ) then
    raise exception 'winner should see completed match with metadata';
  end if;

  perform pg_temp.set_caller('88888888-8888-8888-8888-888888888888');

  if not exists (
    select 1
    from public.list_my_completed_matches() as row
    where row.match_id = v_match_id
      and row.viewer_won is false
  ) then
    raise exception 'loser should see completed match with viewer_won false';
  end if;
end;
$$;

select pass('completed matches list returns confirmed history for participants');

rollback;
