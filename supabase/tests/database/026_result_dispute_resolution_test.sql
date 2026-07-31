\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(3);

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
  p_past_hours integer default 1
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
    )
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
    starts_at = v_start,
    ends_at = v_end
  where id = v_booking_id;

  perform public.start_in_progress_matches();

  return v_match_id;
end;
$$;

create or replace function pg_temp.create_disputed_result(
  p_creator_id uuid,
  p_joiner_id uuid,
  p_past_hours integer default 1
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_result_id uuid;
begin
  v_match_id := pg_temp.create_in_progress_match(p_creator_id, p_joiner_id, p_past_hours);
  perform pg_temp.set_caller(p_creator_id);
  v_result_id := public.submit_match_result(
    v_match_id,
    jsonb_build_object('sets', jsonb_build_array(jsonb_build_array(6, 4), jsonb_build_array(6, 3))),
    p_creator_id
  );
  perform pg_temp.set_caller(p_joiner_id);
  perform public.dispute_match_result(v_match_id, 'score mismatch');
  return v_result_id;
end;
$$;

set local role postgres;

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
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
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-3333-3333-333333333333',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $sql$select * from public.list_disputed_results()$sql$,
  '42501',
  null,
  'club staff cannot list disputed results'
);

select set_config(
  'request.jwt.claim.sub',
  '55555555-5555-5555-5555-555555555555',
  true
);

select ok(
  (
    select count(*) >= 0
    from public.list_disputed_results() as row
  ),
  'platform operator can list disputed results'
);

set local role postgres;

do $$
declare
  v_result_id uuid;
  v_winner_before integer;
  v_winner_after integer;
begin
  v_result_id := pg_temp.create_disputed_result(
    '11111111-1111-1111-1111-111111111111',
    '88888888-8888-8888-8888-888888888888'
  );

  perform pg_temp.set_caller('55555555-5555-5555-5555-555555555555');

  if not exists (
    select 1
    from public.list_disputed_results() as row
    where row.result_id = v_result_id
  ) then
    raise exception 'disputed result should appear in queue';
  end if;

  select pp.internal_rating
  into v_winner_before
  from public.player_profiles as pp
  where pp.user_id = '11111111-1111-1111-1111-111111111111';

  perform public.resolve_match_result_dispute(
    v_result_id,
    'confirm',
    'Both players agreed offline'
  );

  if not exists (
    select 1
    from public.match_results as mr
    where mr.id = v_result_id
      and mr.status = 'confirmed'
  ) then
    raise exception 'confirm resolution should mark result confirmed';
  end if;

  select pp.internal_rating
  into v_winner_after
  from public.player_profiles as pp
  where pp.user_id = '11111111-1111-1111-1111-111111111111';

  if v_winner_after <= v_winner_before then
    raise exception 'confirm resolution should apply rating';
  end if;

  if not exists (
    select 1
    from public.audit_events as ae
    where ae.entity_id = v_result_id
      and ae.action = 'match_result_dispute_resolved'
  ) then
    raise exception 'resolution should create audit event';
  end if;

  v_result_id := pg_temp.create_disputed_result(
    '11111111-1111-1111-1111-111111111111',
    '88888888-8888-8888-8888-888888888888',
    48
  );

  perform pg_temp.set_caller('55555555-5555-5555-5555-555555555555');
  perform public.resolve_match_result_dispute(
    v_result_id,
    'void',
    'Insufficient evidence to confirm'
  );

  if not exists (
    select 1
    from public.match_results as mr
    where mr.id = v_result_id
      and mr.status = 'resolved'
  ) then
    raise exception 'void resolution should mark result resolved';
  end if;

  if exists (
    select 1
    from public.rating_events as re
    where re.result_id = v_result_id
  ) then
    raise exception 'void resolution must not apply rating';
  end if;
end;
$$;

select pass('platform dispute queue and resolution');

rollback;
