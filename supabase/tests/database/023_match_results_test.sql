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

create or replace function pg_temp.create_in_progress_match(
  p_creator_id uuid,
  p_joiner_id uuid,
  p_day_offset integer default 2
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_option_id uuid;
  v_booking_id uuid;
  v_start timestamptz := now() + make_interval(days => p_day_offset);
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
        'starts_at', v_start::text,
        'ends_at', (v_start + interval '90 minutes')::text
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

  update public.bookings
  set
    starts_at = now() - make_interval(hours => 24 + p_day_offset),
    ends_at = now() - make_interval(hours => 23 + p_day_offset)
  where id = v_booking_id;

  perform public.start_in_progress_matches();

  return v_match_id;
end;
$$;

set local role postgres;

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '88888888-8888-8888-8888-888888888888';
  v_match_id uuid;
  v_result_id uuid;
  v_winner_before integer;
  v_loser_before integer;
  v_winner_after integer;
  v_loser_after integer;
  v_existing_id uuid;
begin
  perform pg_temp.set_caller(v_creator);
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

  v_match_id := pg_temp.create_in_progress_match(v_creator, v_joiner);

  perform pg_temp.set_caller(v_creator);
  perform public.record_match_attendance(v_match_id, 'attended');
  perform pg_temp.set_caller(v_joiner);
  perform public.record_match_attendance(v_match_id, 'attended');

  select pp.internal_rating
  into v_winner_before
  from public.player_profiles as pp
  where pp.user_id = v_creator;

  select pp.internal_rating
  into v_loser_before
  from public.player_profiles as pp
  where pp.user_id = v_joiner;

  perform pg_temp.set_caller(v_creator);
  v_result_id := public.submit_match_result(
    v_match_id,
    jsonb_build_object('sets', jsonb_build_array(jsonb_build_array(6, 4), jsonb_build_array(6, 3))),
    v_creator
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.confirm_match_result(v_match_id);

  if not exists (
    select 1
    from public.matches as m
    where m.id = v_match_id
      and m.status = 'completed'
  ) then
    raise exception 'match should be completed after confirmation';
  end if;

  if (select count(*) from public.rating_events as re where re.result_id = v_result_id) <> 2 then
    raise exception 'rating should be applied once per player';
  end if;

  select pp.internal_rating
  into v_winner_after
  from public.player_profiles as pp
  where pp.user_id = v_creator;

  select pp.internal_rating
  into v_loser_after
  from public.player_profiles as pp
  where pp.user_id = v_joiner;

  if v_winner_after <= v_winner_before then
    raise exception 'winner rating should increase';
  end if;

  if v_loser_after >= v_loser_before then
    raise exception 'loser rating should decrease';
  end if;

  perform public.apply_rating_for_result(v_result_id);

  if (select count(*) from public.rating_events as re where re.result_id = v_result_id) <> 2 then
    raise exception 'repeated rating apply must remain idempotent';
  end if;

  v_match_id := pg_temp.create_in_progress_match(v_creator, v_joiner, 5);
  perform pg_temp.set_caller(v_creator);
  perform public.record_match_attendance(v_match_id, 'attended');
  perform pg_temp.set_caller(v_joiner);
  perform public.record_match_attendance(v_match_id, 'attended');
  perform pg_temp.set_caller(v_creator);
  perform public.submit_match_result(
    v_match_id,
    jsonb_build_object('sets', jsonb_build_array(jsonb_build_array(7, 5))),
    v_creator
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.dispute_match_result(v_match_id, 'score mismatch');

  if not exists (
    select 1
    from public.match_results as mr
    where mr.match_id = v_match_id
      and mr.status = 'disputed'
  ) then
    raise exception 'disputed result should remain disputed';
  end if;

  if exists (
    select 1
    from public.rating_events as re
    join public.match_results as mr on mr.id = re.result_id
    where mr.match_id = v_match_id
  ) then
    raise exception 'disputed results must not change ratings';
  end if;
end;
$$;

select pass('match result submit confirm dispute and idempotent rating');

rollback;
