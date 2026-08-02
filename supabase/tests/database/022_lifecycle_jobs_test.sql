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

create or replace function pg_temp.create_ready_match(p_creator_id uuid, p_joiner_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_option_id uuid;
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

  return v_match_id;
end;
$$;

set local role postgres;

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '88888888-8888-8888-8888-888888888888';
  v_staff uuid := '33333333-3333-3333-3333-333333333333';
  v_court_id uuid := 'cccccccc-0001-0001-0001-000000000001';
  v_match_id uuid;
  v_booking_id uuid;
  v_started integer;
  v_reminders jsonb;
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

  v_match_id := pg_temp.create_ready_match(v_creator, v_joiner);

  perform pg_temp.set_caller(v_creator);
  v_booking_id := public.request_match_booking(v_match_id, v_court_id);

  perform pg_temp.set_caller(v_staff);
  perform public.accept_booking(v_booking_id);

  update public.bookings
  set
    starts_at = now() - interval '1 hour',
    ends_at = now() - interval '30 minutes'
  where id = v_booking_id;

  v_started := public.start_in_progress_matches();
  if v_started <> 1 then
    raise exception 'expected one match to start, got %', v_started;
  end if;

  if not exists (
    select 1
    from public.matches as m
    where m.id = v_match_id
      and m.status = 'in_progress'
  ) then
    raise exception 'confirmed match should transition to in_progress at start time';
  end if;

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

  v_match_id := pg_temp.create_ready_match(v_creator, v_joiner);
  perform pg_temp.set_caller(v_creator);
  v_booking_id := public.request_match_booking(v_match_id, v_court_id);

  update public.bookings
  set created_at = now() - interval '5 hours'
  where id = v_booking_id;

  v_reminders := public.booking_stale_reminders();
  if coalesce((v_reminders->>'club_nudges_enqueued')::integer, 0) < 1 then
    raise exception 'expected club booking nudge, got %', v_reminders;
  end if;

  update public.bookings
  set created_at = now() - interval '25 hours'
  where id = v_booking_id;

  v_reminders := public.booking_stale_reminders();
  if coalesce((v_reminders->>'participant_notices_enqueued')::integer, 0) < 1 then
    raise exception 'expected participant stale notice, got %', v_reminders;
  end if;
end;
$$;

select pass('lifecycle jobs start in progress and booking reminders');

rollback;
