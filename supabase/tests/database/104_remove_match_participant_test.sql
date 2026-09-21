\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(12);

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
  v_existing uuid;
begin
  perform pg_temp.set_caller(p_creator);

  for v_existing in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft', 'open', 'full', 'ready_to_book', 'booking_pending')
  loop
    begin
      perform public.cancel_match(v_existing, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;
end;
$$;

-- Instant-join singles far enough out that 090 cannot collide with other
-- fixture hours in this database.
create or replace function pg_temp.singles_match(
  p_creator uuid,
  p_requires_approval boolean default false
)
returns uuid
language plpgsql
as $$
begin
  perform pg_temp.clear_hosted(p_creator);
  perform pg_temp.set_caller(p_creator);

  return public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'competitive'::public.skill_band,
    p_requires_approval,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (date_trunc('hour', now()) + interval '120 days')::text,
        'ends_at', (date_trunc('hour', now()) + interval '120 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The host can remove an accepted player; a stranger and the player cannot
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_player uuid := '22222222-2222-2222-2222-222222222222';
  v_stranger uuid := '99999999-9999-9999-9999-999999999999';
  v_match uuid;
  v_message text;
  v_status public.participant_status;
  v_reason text;
  v_attendance public.attendance_status;
  v_kind text;
  v_payload jsonb;
  v_match_status public.match_status;
begin
  v_match := pg_temp.singles_match(v_host);

  perform pg_temp.set_caller(v_player);
  perform public.join_match(v_match);

  perform pg_temp.set_caller(v_stranger);
  begin
    perform public.remove_match_participant(
      v_match,
      v_player,
      'match_requirements_mismatch'
    );
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%Only the creator can remove a participant%',
    'a stranger must be refused for the right reason, got: ' || v_message
  );

  perform pg_temp.set_caller(v_player);
  begin
    perform public.remove_match_participant(
      v_match,
      v_host,
      'match_requirements_mismatch'
    );
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%Only the creator can remove a participant%',
    'the removed-to-be cannot remove the host, got: ' || v_message
  );

  perform pg_temp.set_caller(v_host);
  begin
    perform public.remove_match_participant(
      v_match,
      v_host,
      'match_requirements_mismatch'
    );
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%cannot_remove_self%',
    'the host cannot remove themselves, got: ' || v_message
  );

  perform public.remove_match_participant(
    v_match,
    v_player,
    'match_requirements_mismatch'
  );

  select mp.status, mp.removed_reason, mp.attendance
  into v_status, v_reason, v_attendance
  from public.match_participants as mp
  where mp.match_id = v_match
    and mp.user_id = v_player;

  perform pg_temp.assert_true(
    v_status = 'removed' and v_reason = 'match_requirements_mismatch',
    'the accepted row should become removed with the reason stored'
  );
  perform pg_temp.assert_true(
    v_attendance::text is distinct from 'no_show'
      and v_attendance::text is distinct from 'late_cancel',
    'removal must not write a no-show or late-cancel attendance'
  );

  select m.status into v_match_status
  from public.matches as m
  where m.id = v_match;

  perform pg_temp.assert_true(
    v_match_status = 'open',
    'removing the second singles player should reopen the listing'
  );

  select n.kind, n.payload
  into v_kind, v_payload
  from public.notifications as n
  where n.user_id = v_player
    and n.kind = 'match_participant_removed'
    and n.entity_id = v_match
  order by n.created_at desc
  limit 1;

  perform pg_temp.assert_true(
    v_kind = 'match_participant_removed'
      and v_payload->'params'->>'reason' = 'match_requirements_mismatch',
    'the removed player should be told, with the reason code'
  );
end;
$$;

select pass('a stranger cannot remove a participant');
select pass('a player cannot remove the host');
select pass('the host cannot remove themselves');
select pass('the host can remove an accepted player with a reason');
select pass('removal does not write a no-show attendance');
select pass('the seat reopens when the match is still recruiting');
select pass('the removed player is notified with the reason');

-- ---------------------------------------------------------------------------
-- Pending asks are declined, not removed; a started match is frozen
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_player uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_message text;
  v_returned public.participant_status;
begin
  v_match := pg_temp.singles_match(v_host, true);

  perform pg_temp.set_caller(v_player);
  perform public.join_match(v_match);

  perform pg_temp.set_caller(v_host);
  begin
    perform public.remove_match_participant(
      v_match,
      v_player,
      'conduct_issue'
    );
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%participant_not_accepted%',
    'a pending request must be declined, not removed, got: ' || v_message
  );

  perform public.respond_to_join_request(v_match, v_player, true);

  update public.match_time_options
  set
    starts_at = now() - interval '10 minutes',
    ends_at = now() + interval '80 minutes'
  where match_id = v_match;

  begin
    perform public.remove_match_participant(
      v_match,
      v_player,
      'player_requested_removal'
    );
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%match_already_started%',
    'removal must stop once the agreed hour has begun, got: ' || v_message
  );
end;
$$;

select pass('a pending request cannot be removed');
select pass('removal is refused after the agreed start');

-- ---------------------------------------------------------------------------
-- Rejoin after removal always asks the host again
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_player uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_returned public.participant_status;
  v_reason text;
begin
  v_match := pg_temp.singles_match(v_host, false);

  perform pg_temp.set_caller(v_player);
  perform public.join_match(v_match);

  perform pg_temp.set_caller(v_host);
  perform public.remove_match_participant(
    v_match,
    v_player,
    'player_requested_removal'
  );

  perform pg_temp.set_caller(v_player);
  v_returned := public.join_match(v_match);

  perform pg_temp.assert_true(
    v_returned = 'requested',
    'rejoining after removal must be a request, even on instant-join, got: '
      || v_returned::text
  );

  select mp.removed_reason
  into v_reason
  from public.match_participants as mp
  where mp.match_id = v_match
    and mp.user_id = v_player;

  perform pg_temp.assert_true(
    v_reason is null,
    'rejoin must clear the stored removal reason'
  );
end;
$$;

select pass('rejoin after removal requires host approval');
select pass('rejoin clears the stored removal reason');

-- ---------------------------------------------------------------------------
-- An unknown reason is refused
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_player uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_message text;
begin
  v_match := pg_temp.singles_match(v_host);

  perform pg_temp.set_caller(v_player);
  perform public.join_match(v_match);

  perform pg_temp.set_caller(v_host);
  begin
    perform public.remove_match_participant(v_match, v_player, 'because');
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%invalid_removal_reason%',
    'free-text reasons must be refused, got: ' || v_message
  );
end;
$$;

select pass('a free-text reason is refused');

select * from finish();
rollback;
