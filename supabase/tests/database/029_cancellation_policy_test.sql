\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(4);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

select is(
  public.late_cancel_window_hours(),
  24,
  'default late cancel window is 24 hours'
);

select is(
  public.classify_withdrawal_attendance(now() + interval '3 days')::text,
  'cancelled_in_time',
  'withdrawal far before start is cancelled in time'
);

select is(
  public.classify_withdrawal_attendance(now() + interval '2 hours')::text,
  'late_cancel',
  'withdrawal within late window is late cancel'
);

set local role postgres;

do $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_option_id uuid;
  v_existing_id uuid;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('open', 'full', 'ready_to_book', 'booking_pending', 'confirmed')
  loop
    perform public.cancel_match(v_existing_id, 'test cleanup');
  end loop;

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

  perform pg_temp.set_caller('88888888-8888-8888-8888-888888888888');
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);
  v_option_id := (v_hub.proposed_times->0->>'id')::uuid;
  perform public.cast_match_time_vote(v_match_id, v_option_id, 'yes'::public.vote_value);

  perform pg_temp.set_caller('88888888-8888-8888-8888-888888888888');
  perform public.cast_match_time_vote(v_match_id, v_option_id, 'yes'::public.vote_value);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  begin
    perform public.cancel_match(v_match_id, null);
    raise exception 'cancel should require reason when match is full';
  exception
    when others then
      if sqlerrm not like '%Cancellation reason is required%' then
        raise;
      end if;
  end;

  perform public.cancel_match(v_match_id, 'Weather concern');

  if not exists (
    select 1
    from public.matches as m
    where m.id = v_match_id
      and m.status = 'cancelled'
      and m.cancellation_reason = 'Weather concern'
  ) then
    raise exception 'creator cancel with reason should cancel match';
  end if;
end;
$$;

select pass('cancellation policy rules');

rollback;
