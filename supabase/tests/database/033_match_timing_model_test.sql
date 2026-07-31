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

create or replace function pg_temp.clear_hosted(p_user_id uuid, p_format public.match_format)
returns void
language plpgsql
as $$
declare
  v_existing_id uuid;
begin
  perform pg_temp.set_caller(p_user_id);
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
end;
$$;

create or replace function pg_temp.new_fixed_match(
  p_creator uuid,
  p_starts timestamptz
)
returns uuid
language plpgsql
as $$
begin
  perform pg_temp.clear_hosted(p_creator, 'singles');
  perform pg_temp.set_caller(p_creator);

  return public.create_and_publish_match(
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
        'starts_at', p_starts::text,
        'ends_at', (p_starts + interval '90 minutes')::text
      )
    ),
    'fixed'
  );
end;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Joining is consent: a full roster is bookable with no vote
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_hub public.match_hub_card;
begin
  v_match_id := pg_temp.new_fixed_match(v_creator, now() + interval '3 days');

  perform pg_temp.set_caller(v_creator);
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'open',
    'a published fixed match starts open'
  );
  perform pg_temp.assert_true(
    v_hub.selected_time_option_id is not null,
    'a fixed match carries its agreed time from publish'
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller(v_creator);
  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.status = 'ready_to_book',
    'a full fixed match is bookable without any vote'
  );
  perform pg_temp.assert_true(
    v_hub.next_action = 'request_court',
    'the host is told to request a court next'
  );
end;
$$;

select pass('joining a fixed match is consent to its time');

-- ---------------------------------------------------------------------------
-- Voting is refused on a fixed match
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_option_id uuid;
  v_message text := '';
begin
  v_match_id := pg_temp.new_fixed_match(v_creator, now() + interval '3 days');

  perform pg_temp.set_caller(v_creator);
  v_hub := public.get_match_hub(v_match_id);
  v_option_id := (v_hub.proposed_times->0->>'id')::uuid;

  begin
    perform public.cast_match_time_vote(
      v_match_id, v_option_id, 'yes'::public.vote_value
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%match_uses_fixed_time%',
    format('voting on a fixed match must be refused, got: %s', v_message)
  );

  v_message := '';
  begin
    perform public.add_match_time_option(
      v_match_id, now() + interval '6 days', now() + interval '6 days 90 minutes'
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%match_uses_fixed_time%',
    format('adding an option to a fixed match must be refused, got: %s', v_message)
  );
end;
$$;

select pass('fixed matches refuse voting and extra time options');

-- ---------------------------------------------------------------------------
-- Host reschedule, and the booking lock
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_old_option uuid;
  v_new_option uuid;
  v_message text := '';
begin
  v_match_id := pg_temp.new_fixed_match(v_creator, now() + interval '3 days');

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match_id);

  perform pg_temp.set_caller(v_creator);
  v_hub := public.get_match_hub(v_match_id);
  v_old_option := v_hub.selected_time_option_id;

  v_new_option := public.reschedule_match_time(
    v_match_id,
    now() + interval '5 days',
    now() + interval '5 days 90 minutes'
  );

  v_hub := public.get_match_hub(v_match_id);
  perform pg_temp.assert_true(
    v_hub.selected_time_option_id = v_new_option
      and v_new_option <> v_old_option,
    'reschedule should move the match onto a new time option'
  );
  perform pg_temp.assert_true(
    v_hub.status = 'ready_to_book',
    'a full match stays bookable after a reschedule'
  );

  -- A non-host must not be able to move the match.
  perform pg_temp.set_caller(v_joiner);
  begin
    perform public.reschedule_match_time(
      v_match_id, now() + interval '7 days', now() + interval '7 days 90 minutes'
    );
  exception
    when others then
      v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%Only the creator%',
    format('only the host may reschedule, got: %s', v_message)
  );

  -- Once a court is requested the hour is committed at the club.
  perform pg_temp.set_caller(v_creator);
  perform public.request_match_booking(
    v_match_id,
    'cccccccc-0001-0001-0001-000000000001'
  );

  v_message := '';
  begin
    perform public.reschedule_match_time(
      v_match_id, now() + interval '8 days', now() + interval '8 days 90 minutes'
    );
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%match_time_locked_by_booking%',
    format('reschedule must be refused once a booking exists, got: %s', v_message)
  );
end;
$$;

select pass('the host can reschedule until a court is requested');

-- ---------------------------------------------------------------------------
-- Suggestions are ranked by how many compatible players are free
-- ---------------------------------------------------------------------------

do $$
declare
  v_viewer uuid := '11111111-1111-1111-1111-111111111111';
  v_other uuid := '22222222-2222-2222-2222-222222222222';
  v_rows integer := 0;
  v_best integer := -1;
  v_row record;
begin
  perform pg_temp.set_caller(v_viewer);
  perform public.set_recurring_availability(
    jsonb_build_array(
      jsonb_build_object('weekday', 1, 'local_start', '17:00', 'local_end', '22:00')
    )
  );

  perform pg_temp.set_caller(v_other);
  perform public.set_recurring_availability(
    jsonb_build_array(
      jsonb_build_object('weekday', 1, 'local_start', '17:00', 'local_end', '22:00')
    )
  );

  perform pg_temp.set_caller(v_viewer);

  for v_row in
    select *
    from public.suggest_match_times(null, null, null, null, 14, 90, 3)
  loop
    v_rows := v_rows + 1;
    if v_best < 0 then
      v_best := v_row.candidate_count;
    end if;
    perform pg_temp.assert_true(
      v_row.ends_at > v_row.starts_at,
      'a suggested slot must be non-empty'
    );
    perform pg_temp.assert_true(
      v_row.starts_at >= now(),
      'suggestions must be in the future'
    );
  end loop;

  perform pg_temp.assert_true(v_rows > 0, 'the host should get time suggestions');
  perform pg_temp.assert_true(
    v_best >= 1,
    'the top suggestion should have at least one available player'
  );
end;
$$;

select pass('time suggestions are ranked by available players');

select * from finish();
rollback;
