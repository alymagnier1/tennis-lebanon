\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(5);

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

-- Same shape as the open match in 061, except the host screens joiners. That
-- is the whole point: `join_match` writes `requested` instead of `accepted`.
create or replace function pg_temp.approval_match(p_creator uuid)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
begin
  perform pg_temp.clear_hosted(p_creator);
  perform pg_temp.set_caller(p_creator);

  v_match_id := public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    true,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  return v_match_id;
end;
$$;

create or replace function pg_temp.notification_count(
  p_user_id uuid,
  p_kind text,
  p_match_id uuid
)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.notifications as n
  where n.user_id = p_user_id
    and n.kind = p_kind
    and n.entity_id = p_match_id;
$$;

create or replace function pg_temp.total_requests(p_match_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.notifications as n
  where n.kind = 'match_join_request'
    and n.entity_id = p_match_id;
$$;

-- ---------------------------------------------------------------------------
-- Asking to join reaches the host, and only the host
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_asker uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.approval_match(v_creator);

  perform pg_temp.assert_true(
    pg_temp.total_requests(v_match) = 0,
    'publishing the match must not raise a join request'
  );

  perform pg_temp.set_caller(v_asker);
  perform pg_temp.assert_true(
    public.join_match(v_match)::text = 'requested',
    'an approval-required match should hold the joiner as requested'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_join_request', v_match) = 1,
    'the host should be told someone asked to join'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_asker, 'match_join_request', v_match) = 0,
    'the asker should not be told about their own request'
  );

  -- Only the host can accept or decline, so telling anyone else publishes a
  -- decision the host has not made yet.
  perform pg_temp.assert_true(
    pg_temp.total_requests(v_match) = 1,
    'nobody besides the host should hear about a pending request'
  );
end;
$$;

select pass('a join request notifies the host');
select pass('a join request does not notify the asker');
select pass('a join request stays off the rest of the roster');

-- ---------------------------------------------------------------------------
-- Declined and asking again in the same bucket must not ping the host twice
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_asker uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.approval_match(v_creator);

  perform pg_temp.set_caller(v_asker);
  perform public.join_match(v_match);

  -- The host declines, the player asks again a moment later.
  update public.match_participants
  set status = 'left'
  where match_id = v_match
    and user_id = v_asker;

  update public.match_participants
  set status = 'requested'
  where match_id = v_match
    and user_id = v_asker;

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_join_request', v_match) = 1,
    'asking again inside the dedup bucket should not ping the host twice'
  );
end;
$$;

select pass('repeat requests collapse into one notification');

-- ---------------------------------------------------------------------------
-- A creator holding a requested row is never notified about themselves
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_match uuid;
begin
  v_match := pg_temp.approval_match(v_creator);

  update public.match_participants
  set status = 'requested'
  where match_id = v_match
    and user_id = v_creator;

  perform pg_temp.assert_true(
    pg_temp.total_requests(v_match) = 0,
    'a creator must never be notified of their own join request'
  );
end;
$$;

select pass('the creator is never notified about their own request');

select * from finish();

rollback;
