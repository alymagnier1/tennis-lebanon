\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(11);

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
        'starts_at', (date_trunc('hour', now()) + interval '150 days')::text,
        'ends_at', (date_trunc('hour', now()) + interval '150 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );
end;
$$;

/** Suspended, and not by a terminal write. */
create or replace function pg_temp.is_superseded(p_match uuid, p_user uuid)
returns boolean
language sql
stable
as $$
  select coalesce(bool_or(
    mi.superseded_at is not null
    and mi.revoked_at is null
    and mi.declined_at is null
    and mi.accepted_at is null
  ), false)
  from public.match_invitations as mi
  where mi.match_id = p_match and mi.invited_user_id = p_user;
$$;

/** Waiting again: nothing set at all. */
create or replace function pg_temp.is_pending(p_match uuid, p_user uuid)
returns boolean
language sql
stable
as $$
  select coalesce(bool_or(
    mi.superseded_at is null
    and mi.revoked_at is null
    and mi.declined_at is null
    and mi.accepted_at is null
  ), false)
  from public.match_invitations as mi
  where mi.match_id = p_match and mi.invited_user_id = p_user;
$$;

-- Scoped to the match, not just the user. `notifications` is not rolled back
-- out of existence between whatever else has touched this database, so a
-- global count per user makes the assertion depend on history that has nothing
-- to do with the test.
create or replace function pg_temp.notif_count(
  p_match uuid,
  p_user uuid,
  p_kind text
)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.notifications as n
  where n.entity_id = p_match
    and n.user_id = p_user
    and n.kind = p_kind;
$$;

-- ---------------------------------------------------------------------------
-- The two fill paths must agree. This is the whole migration.
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_taker uuid := '88888888-8888-8888-8888-888888888888';
  v_other uuid := '77777777-7777-7777-7777-777777777777';
  v_joiner uuid := '99999999-9999-9999-9999-999999999999';
  v_match uuid;
  v_invite uuid;
begin
  -- Path A: the seat goes to somebody accepting an invitation.
  v_match := pg_temp.new_match(v_host, 'singles');
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_taker, null);
  perform public.create_match_invite(v_match, v_other, null);

  select mi.id into v_invite from public.match_invitations as mi
  where mi.match_id = v_match and mi.invited_user_id = v_taker;

  perform pg_temp.set_caller(v_taker);
  perform public.accept_match_invitation(v_invite);

  perform pg_temp.assert_true(
    pg_temp.is_superseded(v_match, v_other),
    'path A: the unfilled invitation should be suspended, not revoked'
  );
  perform pg_temp.assert_true(
    pg_temp.notif_count(v_match, v_other, 'match_invitation_superseded') = 1,
    'path A: the superseded player should be told once'
  );

  -- Path B: the seat goes to somebody arriving through Discover. The old code
  -- never ran its revoke here at all, which is how the two paths diverged.
  v_match := pg_temp.new_match(v_host, 'singles');
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_other, null);

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match, null);

  perform pg_temp.assert_true(
    pg_temp.is_superseded(v_match, v_other),
    'path B: join_match must suspend pending invitations exactly as path A does'
  );
end;
$$;

select pass('an invite acceptance suspends the other invitations');
select pass('the superseded player is notified once');
select pass('an ordinary join suspends them identically');

-- ---------------------------------------------------------------------------
-- A seat reopening brings them back -- and only the ones still acceptable
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '99999999-9999-9999-9999-999999999999';
  v_waiting uuid := '77777777-7777-7777-7777-777777777777';
  v_decliner uuid := '88888888-8888-8888-8888-888888888888';
  v_withdrawn uuid := '13131313-1313-1313-1313-131313131313';
  v_match uuid;
begin
  v_match := pg_temp.new_match(v_host, 'singles');
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_waiting, null);
  perform public.create_match_invite(v_match, v_decliner, null);
  perform public.create_match_invite(v_match, v_withdrawn, null);

  -- One says no; the host takes another back. Both are terminal.
  perform pg_temp.set_caller(v_decliner);
  perform public.decline_match_invitation((
    select mi.id from public.match_invitations as mi
    where mi.match_id = v_match and mi.invited_user_id = v_decliner
  ));
  perform pg_temp.set_caller(v_host);
  perform public.cancel_match_invite(v_match, v_withdrawn);

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match, null);
  perform pg_temp.assert_true(
    pg_temp.is_superseded(v_match, v_waiting),
    'the waiting invitation should suspend when the seat goes'
  );

  -- The seat reopens.
  perform public.leave_match(v_match);

  perform pg_temp.assert_true(
    pg_temp.is_pending(v_match, v_waiting),
    'a reopened seat should bring the waiting invitation back'
  );
  perform pg_temp.assert_true(
    pg_temp.notif_count(v_match, v_waiting, 'match_seat_reopened') = 1,
    'the restored player should be told the seat reopened'
  );

  -- A refusal and a withdrawal are answers, not pauses. Restoring either would
  -- re-offer a match one player already turned down and the host took back.
  perform pg_temp.assert_true(
    not pg_temp.is_pending(v_match, v_decliner),
    'a decline must not be undone by a seat reopening'
  );
  perform pg_temp.assert_true(
    not pg_temp.is_pending(v_match, v_withdrawn),
    'a host withdrawal must not be undone by a seat reopening'
  );
  perform pg_temp.assert_true(
    (select mi.declined_at is not null from public.match_invitations as mi
     where mi.match_id = v_match and mi.invited_user_id = v_decliner),
    'the decline itself must survive untouched'
  );
end;
$$;

select pass('a reopened seat restores a waiting invitation');
select pass('the restored player is notified');
select pass('a decline is not undone by a reopening');
select pass('a withdrawal is not undone by a reopening');
select pass('the decline record survives');

-- ---------------------------------------------------------------------------
-- Doubles suspends at capacity, not at the first join
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_waiting uuid := '77777777-7777-7777-7777-777777777777';
  v_match uuid;
begin
  v_match := pg_temp.new_match(v_host, 'doubles');
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_waiting, null);

  perform pg_temp.set_caller('99999999-9999-9999-9999-999999999999');
  perform public.join_match(v_match, null);
  perform pg_temp.assert_true(
    pg_temp.is_pending(v_match, v_waiting),
    'a doubles match with seats left must not suspend anything'
  );

  perform pg_temp.set_caller('10101010-1010-1010-1010-101010101010');
  perform public.join_match(v_match, null);
  perform pg_temp.set_caller('12121212-1212-1212-1212-121212121212');
  perform public.join_match(v_match, null);

  perform pg_temp.assert_true(
    pg_temp.is_superseded(v_match, v_waiting),
    'the fourth player filling the roster should suspend it'
  );
end;
$$;

select pass('doubles suspends only once the roster is full');

-- ---------------------------------------------------------------------------
-- Leaving the recruiting set closes everything still waiting
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_waiting uuid := '77777777-7777-7777-7777-777777777777';
  v_asker uuid := '88888888-8888-8888-8888-888888888888';
  v_match uuid;
begin
  v_match := pg_temp.new_match(v_host, 'doubles');
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_waiting, null);

  -- A pending request the host never answered.
  update public.matches set requires_creator_approval = true where id = v_match;
  perform pg_temp.set_caller(v_asker);
  perform public.join_match(v_match, null);

  perform pg_temp.set_caller(v_host);
  perform public.cancel_match(v_match, 'calling it off');

  perform pg_temp.assert_true(
    (select mi.revoked_at is not null from public.match_invitations as mi
     where mi.match_id = v_match and mi.invited_user_id = v_waiting),
    'a cancelled match must close its outstanding invitations'
  );
  perform pg_temp.assert_true(
    (select mp.status = 'declined' from public.match_participants as mp
     where mp.match_id = v_match and mp.user_id = v_asker),
    'a cancelled match must close its waitlist'
  );
end;
$$;

select pass('leaving the recruiting set revokes waiting invitations');
select pass('leaving the recruiting set declines the waitlist');

select * from finish();

rollback;
