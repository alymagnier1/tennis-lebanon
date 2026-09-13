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

-- Doubles, so invitees sit alongside an accepted joiner without filling the
-- roster and moving the match out of `open`. Same helper shape as `093`.
create or replace function pg_temp.doubles_match(p_creator uuid)
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
    'doubles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'competitive'::public.skill_band,
    false,
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

create or replace function pg_temp.invite_id(p_match_id uuid, p_invited uuid)
returns uuid
language sql
stable
as $$
  select mi.id
  from public.match_invitations as mi
  where mi.match_id = p_match_id
    and mi.invited_user_id = p_invited
    and mi.revoked_at is null
    and mi.accepted_at is null
  order by mi.created_at desc
  limit 1;
$$;

create or replace function pg_temp.invited_count(p_match_id uuid, p_status text)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from jsonb_array_elements(
    coalesce((public.get_match_hub(p_match_id)).invited_players, '[]'::jsonb)
  ) as e
  where e->>'status' = p_status;
$$;

-- ---------------------------------------------------------------------------
-- Who may withdraw an invitation
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_invited_by_host uuid := '88888888-8888-8888-8888-888888888888';
  v_invited_by_joiner uuid := '77777777-7777-7777-7777-777777777777';
  v_stranger uuid := '99999999-9999-9999-9999-999999999999';
  v_match uuid;
  v_message text;
begin
  v_match := pg_temp.doubles_match(v_host);

  -- A second accepted participant, who may invite in their own right.
  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);

  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_invited_by_host, null);

  perform pg_temp.set_caller(v_joiner);
  perform public.create_match_invite(v_match, v_invited_by_joiner, null);

  -- The player who sent it can take it back.
  perform public.cancel_match_invite(v_match, v_invited_by_joiner);
  perform pg_temp.assert_true(
    pg_temp.invite_id(v_match, v_invited_by_joiner) is null,
    'an inviter should be able to withdraw their own invitation'
  );

  -- Somebody with no claim on it cannot, even though the invitation is live.
  --
  -- Asserted on the message, not just the error class: a caller who failed
  -- `assert_marketplace_caller` would also raise `insufficient_privilege`, so
  -- catching the class alone would pass even if this function never ran its
  -- own authorization at all.
  perform pg_temp.set_caller(v_stranger);
  begin
    perform public.cancel_match_invite(v_match, v_invited_by_host);
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%Not your invite%',
    'a third party must be refused for the right reason, got: ' || v_message
  );

  perform pg_temp.set_caller(v_host);
  perform pg_temp.assert_true(
    pg_temp.invite_id(v_match, v_invited_by_host) is not null,
    'the refused withdrawal must leave the invitation standing'
  );

  -- The host owns the match, so they can withdraw an invitation they did not
  -- send. Re-sent by the joiner first, since the host already has one of their
  -- own outstanding.
  perform pg_temp.set_caller(v_joiner);
  perform public.create_match_invite(v_match, v_invited_by_joiner, null);

  perform pg_temp.set_caller(v_host);
  perform public.cancel_match_invite(v_match, v_invited_by_joiner);
  perform pg_temp.assert_true(
    pg_temp.invite_id(v_match, v_invited_by_joiner) is null,
    'the match creator should be able to withdraw any invitation on it'
  );
end;
$$;

select pass('an inviter can withdraw their own invitation');
select pass('a third party cannot withdraw an invitation');
select pass('a refused withdrawal leaves the invitation standing');
select pass('the match creator can withdraw any invitation');

-- ---------------------------------------------------------------------------
-- A withdrawal is not a decline, and cannot be repeated
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_invited uuid := '88888888-8888-8888-8888-888888888888';
  v_match uuid;
  v_repeated boolean := false;
begin
  v_match := pg_temp.doubles_match(v_host);

  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_invited, null);
  perform public.cancel_match_invite(v_match, v_invited);

  -- `093` split `declined_at` out of `revoked_at` precisely so the hub could
  -- tell a refusal from a withdrawal. Withdrawing must not accuse the invitee
  -- of having said no.
  perform pg_temp.assert_true(
    pg_temp.invited_count(v_match, 'declined') = 0,
    'a withdrawal must not be reported as a decline'
  );
  perform pg_temp.assert_true(
    pg_temp.invited_count(v_match, 'invited') = 0,
    'a withdrawn invitation must leave the waiting list'
  );

  begin
    perform public.cancel_match_invite(v_match, v_invited);
  exception when no_data_found then
    v_repeated := true;
  end;
  perform pg_temp.assert_true(
    v_repeated,
    'withdrawing an already-withdrawn invitation should raise'
  );
end;
$$;

select pass('a withdrawal is not recorded as a decline');
select pass('a withdrawn invitation leaves the hub list');
select pass('withdrawing twice raises');

-- ---------------------------------------------------------------------------
-- Guards on creating an invitation
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_match uuid;
  v_message text;
begin
  v_match := pg_temp.doubles_match(v_host);

  perform pg_temp.set_caller(v_host);
  perform public.cancel_match(v_match, 'closing it');

  -- `021` raised this; `044` dropped it and `086`/`088` carried the omission
  -- forward, so until now a cancelled match still accepted invitations --
  -- spending the daily quota and pushing a notification for a match nobody
  -- could ever join.
  begin
    perform public.create_match_invite(v_match, '88888888-8888-8888-8888-888888888888', null);
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%match_not_invitable%',
    'a cancelled match must refuse new invitations, got: ' || v_message
  );
end;
$$;

select pass('a cancelled match refuses new invitations');

-- ---------------------------------------------------------------------------
-- The per-match cap: open seats plus two
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_match uuid;
  v_targets uuid[] := array[
    '88888888-8888-8888-8888-888888888888',
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    -- Not `66666666`: the seed has `11111111` blocking them, and
    -- `create_match_invite` refuses a blocked pair before it reaches the cap.
    '13131313-1313-1313-1313-131313131313',
    '10101010-1010-1010-1010-101010101010'
  ]::uuid[];
  v_target uuid;
  v_message text;
begin
  v_match := pg_temp.doubles_match(v_host);
  perform pg_temp.set_caller(v_host);

  -- Doubles with only the host accepted: three open seats, so five pending
  -- targeted invitations are allowed.
  foreach v_target in array v_targets loop
    perform public.create_match_invite(v_match, v_target, null);
  end loop;

  begin
    perform public.create_match_invite(v_match, '12121212-1212-1212-1212-121212121212', null);
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%invite_cap_reached%',
    'the sixth pending invitation should hit the cap, got: ' || v_message
  );

  -- Re-inviting somebody who already holds one replaces their invitation
  -- rather than adding a sixth, so the cap must not refuse it.
  perform public.create_match_invite(v_match, v_targets[1], null);
  perform pg_temp.assert_true(
    pg_temp.invite_id(v_match, v_targets[1]) is not null,
    're-inviting an already-invited player must not be refused at the cap'
  );
end;
$$;

select pass('the invite cap refuses one too many');
select pass('the cap still allows a re-invite');

select * from finish();

rollback;
