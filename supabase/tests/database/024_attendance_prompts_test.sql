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
  p_joiner_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_option_id uuid;
  v_booking_id uuid;
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
  v_booking_id := public.request_match_booking(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001'
  );

  perform pg_temp.set_caller('33333333-3333-3333-3333-333333333333');
  perform public.accept_booking(v_booking_id);

  update public.bookings
  set
    starts_at = now() - interval '1 hour',
    ends_at = now() - interval '30 minutes'
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
  v_prompts integer;
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

  v_prompts := public.schedule_attendance_prompts();
  if v_prompts <> 2 then
    raise exception 'expected two attendance prompts, got %', v_prompts;
  end if;

  if not exists (
    select 1
    from public.notifications as n
    where n.kind = 'attendance_prompt'
      and n.entity_id = v_match_id
      and n.user_id = v_creator
  ) then
    raise exception 'creator should receive attendance prompt';
  end if;

  if not exists (
    select 1
    from public.notifications as n
    where n.kind = 'attendance_prompt'
      and n.entity_id = v_match_id
      and n.user_id = v_joiner
  ) then
    raise exception 'joiner should receive attendance prompt';
  end if;

  v_prompts := public.schedule_attendance_prompts();
  if v_prompts <> 0 then
    raise exception 'attendance prompts should deduplicate, got %', v_prompts;
  end if;

  perform pg_temp.set_caller(v_creator);
  perform public.record_match_attendance(v_match_id, 'attended');

  v_prompts := public.schedule_attendance_prompts();
  if v_prompts <> 0 then
    raise exception 'joiner prompt should not duplicate after creator records attendance, got %', v_prompts;
  end if;
end;
$$;

select pass('attendance prompt scheduling');

rollback;
