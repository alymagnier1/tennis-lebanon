\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(10);

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

create or replace function pg_temp.new_match(
  p_creator uuid,
  p_format public.match_format
)
returns uuid
language plpgsql
as $$
declare
  v_existing uuid;
begin
  perform pg_temp.set_caller(p_creator);

  for v_existing in
    select lm.match_id from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft','open','full','ready_to_book','booking_pending')
  loop
    begin perform public.cancel_match(v_existing, 'test cleanup'); exception when others then null; end;
  end loop;

  return public.create_and_publish_match(
    p_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'beginner'::public.skill_band,
    'competitive'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (date_trunc('hour', now()) + interval '160 days')::text,
        'ends_at', (date_trunc('hour', now()) + interval '160 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );
end;
$$;

/** Rows the calling viewer sees for one player, and the status on each. */
create or replace function pg_temp.invited_rows(p_match uuid, p_user uuid)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(e->>'status' order by e->>'status'), array[]::text[])
  from jsonb_array_elements(
    coalesce((public.get_match_hub(p_match)).invited_players, '[]'::jsonb)
  ) as e
  where (e->>'user_id')::uuid = p_user;
$$;

create or replace function pg_temp.next_action(p_match uuid)
returns text
language sql
stable
as $$
  select (public.get_match_hub(p_match)).next_action;
$$;

-- ---------------------------------------------------------------------------
-- One row per player, whatever their history
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_twice uuid := '88888888-8888-8888-8888-888888888888';
  v_joiner uuid := '99999999-9999-9999-9999-999999999999';
  v_match uuid;
begin
  v_match := pg_temp.new_match(v_host, 'doubles');

  -- Declined, then asked again. Two invitations, one player.
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_twice, null);
  perform pg_temp.set_caller(v_twice);
  perform public.decline_match_invitation((
    select mi.id from public.match_invitations as mi
    where mi.match_id = v_match and mi.invited_user_id = v_twice
  ));
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_twice, null);

  perform pg_temp.assert_true(
    array_length(pg_temp.invited_rows(v_match, v_twice), 1) = 1,
    'a re-invited player must appear once, not once per invitation'
  );
  perform pg_temp.assert_true(
    pg_temp.invited_rows(v_match, v_twice) = array['invited'],
    'the newest invitation is the live one, so the row reads invited'
  );

  -- Invited, then arrived under their own steam. An invitation and a roster
  -- row for the same person listed them in two sections at once.
  perform public.create_match_invite(v_match, v_joiner, null);
  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match, null);

  perform pg_temp.set_caller(v_host);
  perform pg_temp.assert_true(
    pg_temp.invited_rows(v_match, v_joiner) = array[]::text[],
    'a player who joined must leave the invited list to the roster'
  );
end;
$$;

select pass('a re-invited player appears once');
select pass('the newest invitation wins');
select pass('a player who joined leaves the invited list');

-- ---------------------------------------------------------------------------
-- Suspension is reported as itself
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_waiting uuid := '77777777-7777-7777-7777-777777777777';
  v_filler uuid := '99999999-9999-9999-9999-999999999999';
  v_match uuid;
begin
  v_match := pg_temp.new_match(v_host, 'singles');
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_waiting, null);

  perform pg_temp.set_caller(v_filler);
  perform public.join_match(v_match, null);

  perform pg_temp.set_caller(v_host);
  perform pg_temp.assert_true(
    pg_temp.invited_rows(v_match, v_waiting) = array['superseded'],
    'a suspended invitation must not still read as waiting to answer'
  );

  perform pg_temp.set_caller(v_filler);
  perform public.leave_match(v_match);

  perform pg_temp.set_caller(v_host);
  perform pg_temp.assert_true(
    pg_temp.invited_rows(v_match, v_waiting) = array['invited'],
    'a restored invitation reads as waiting again'
  );
end;
$$;

select pass('a suspended invitation reports as superseded');
select pass('a restored invitation reports as invited');

-- ---------------------------------------------------------------------------
-- Who the list answers
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_mate uuid := '22222222-2222-2222-2222-222222222222';
  v_asked_by_host uuid := '77777777-7777-7777-7777-777777777777';
  v_decliner uuid := '88888888-8888-8888-8888-888888888888';
  v_outsider uuid := '13131313-1313-1313-1313-131313131313';
  v_match uuid;
begin
  v_match := pg_temp.new_match(v_host, 'doubles');

  perform pg_temp.set_caller(v_mate);
  perform public.join_match(v_match, null);

  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_asked_by_host, null);
  perform public.create_match_invite(v_match, v_decliner, null);
  perform pg_temp.set_caller(v_decliner);
  perform public.decline_match_invitation((
    select mi.id from public.match_invitations as mi
    where mi.match_id = v_match and mi.invited_user_id = v_decliner
  ));

  -- The whole point of widening: a second inviter can now see that the host
  -- already asked this player, so they do not ask again.
  perform pg_temp.set_caller(v_mate);
  perform pg_temp.assert_true(
    pg_temp.invited_rows(v_match, v_asked_by_host) = array['invited'],
    'another participant who may invite must see the pending invitation'
  );

  -- But a refusal stays between the player and whoever asked. `093` made that
  -- call for the roster and it still holds.
  perform pg_temp.assert_true(
    pg_temp.invited_rows(v_match, v_decliner) = array[]::text[],
    'a decline must not be published to the rest of the roster'
  );

  perform pg_temp.set_caller(v_host);
  perform pg_temp.assert_true(
    pg_temp.invited_rows(v_match, v_decliner) = array['declined'],
    'the host still sees the decline'
  );

  -- Somebody with no place in the match sees none of it.
  perform pg_temp.set_caller(v_outsider);
  perform pg_temp.assert_true(
    coalesce(jsonb_array_length(
      coalesce((public.get_match_hub(v_match)).invited_players, '[]'::jsonb)
    ), 0) = 0,
    'a non-participant must see nobody'
  );
end;
$$;

select pass('a fellow participant sees pending invitations');
select pass('a decline stays off the rest of the roster');
select pass('the host still sees declines');
select pass('a non-participant sees nothing');

-- ---------------------------------------------------------------------------
-- A pending requester is told they are waiting
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_asker uuid := '88888888-8888-8888-8888-888888888888';
  v_match uuid;
begin
  v_match := pg_temp.new_match(v_host, 'doubles');
  update public.matches set requires_creator_approval = true where id = v_match;

  perform pg_temp.set_caller(v_asker);
  perform public.join_match(v_match, null);

  perform pg_temp.assert_true(
    pg_temp.next_action(v_match) = 'request_pending',
    'a pending requester should be told they are waiting, not shown view_match'
  );
end;
$$;

select pass('a pending requester gets request_pending');

select * from finish();

rollback;
