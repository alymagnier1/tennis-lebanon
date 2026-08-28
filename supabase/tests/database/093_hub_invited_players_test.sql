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

  -- Doubles, so invitees can sit alongside an accepted joiner without filling
  -- the roster and moving the match out of `open`.
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
-- The host sees both the waiting invitation and the decline
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_waiting uuid := '88888888-8888-8888-8888-888888888888';
  v_decliner uuid := '77777777-7777-7777-7777-777777777777';
  v_match uuid;
begin
  v_match := pg_temp.doubles_match(v_host);

  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_waiting, null);
  perform public.create_match_invite(v_match, v_decliner, null);

  -- The invited player says no. Not a participant write: an invite lives in
  -- `match_invitations` until it is accepted.
  perform pg_temp.set_caller(v_decliner);
  perform public.decline_match_invitation((
    select mi.id from public.match_invitations as mi
    where mi.match_id = v_match and mi.invited_user_id = v_decliner
  ));

  perform pg_temp.set_caller(v_host);
  perform pg_temp.assert_true(
    pg_temp.invited_count(v_match, 'invited') = 1,
    'the host should see the invitation still waiting'
  );

  perform pg_temp.assert_true(
    pg_temp.invited_count(v_match, 'declined') = 1,
    'the host should see the decline'
  );

  -- A host withdrawing an offer is not the invitee refusing it. Both write
  -- `revoked_at`; only the refusal writes `declined_at`, and only the refusal
  -- belongs in this list.
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, '99999999-9999-9999-9999-999999999999', null);
  update public.match_invitations
  set revoked_at = now()
  where match_id = v_match
    and invited_user_id = '99999999-9999-9999-9999-999999999999';

  perform pg_temp.assert_true(
    pg_temp.invited_count(v_match, 'declined') = 1,
    'a host withdrawal must not be reported as a decline'
  );
end;
$$;

select pass('the host sees a waiting invitation');
select pass('the host sees a decline');
select pass('a host withdrawal is not counted as a decline');

-- ---------------------------------------------------------------------------
-- Nobody else sees any of it
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_waiting uuid := '88888888-8888-8888-8888-888888888888';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_card public.match_hub_card;
begin
  v_match := pg_temp.doubles_match(v_host);

  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_waiting, null);

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);

  v_card := public.get_match_hub(v_match);

  perform pg_temp.assert_true(
    coalesce(jsonb_array_length(coalesce(v_card.invited_players, '[]'::jsonb)), 0) = 0,
    'a non-creator must not see who was invited'
  );
end;
$$;

select pass('invitations stay off every other viewer''s card');

select * from finish();

rollback;
