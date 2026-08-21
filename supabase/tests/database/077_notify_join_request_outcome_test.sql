\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(6);

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

-- ---------------------------------------------------------------------------
-- Accepted: the player who asked is the one person the roster call excludes
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

  perform pg_temp.set_caller(v_creator);
  perform public.respond_to_join_request(v_match, v_asker, true);

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_asker, 'match_request_accepted', v_match) = 1,
    'an accepted player should be told they are in the match'
  );

  -- `notify_match_participants` excludes the subject, which is why the promoted
  -- player needed a notification of their own rather than this one.
  perform pg_temp.assert_true(
    pg_temp.notification_count(v_asker, 'match_participant_joined', v_match) = 0,
    'the accepted player should not also get the roster notification'
  );

  -- Regression: the host still hears that the roster changed.
  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_participant_joined', v_match) = 1,
    'the host should still be told the roster gained a player'
  );
end;
$$;

select pass('accepting a request tells the player they are in');
select pass('the accepted player does not get the roster notification');
select pass('accepting still notifies the existing roster');

-- ---------------------------------------------------------------------------
-- Declined: silence here meant the match simply vanished from their list
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_asker uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_link text;
begin
  v_match := pg_temp.approval_match(v_creator);

  perform pg_temp.set_caller(v_asker);
  perform public.join_match(v_match);

  perform pg_temp.set_caller(v_creator);
  perform public.respond_to_join_request(v_match, v_asker, false);

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_asker, 'match_request_declined', v_match) = 1,
    'a declined player should be told, since the match leaves their list'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_request_declined', v_match) = 0,
    'a decline is not the rest of the roster''s business'
  );

  -- `get_match_hub` refuses a declined viewer, so the hub would be a dead end.
  select n.payload ->> 'deepLink'
  into v_link
  from public.notifications as n
  where n.user_id = v_asker
    and n.kind = 'match_request_declined'
    and n.entity_id = v_match;

  perform pg_temp.assert_true(
    v_link = '/discover',
    'a declined player should be sent to discovery, not to a hub they cannot read'
  );
end;
$$;

select pass('declining a request tells the player');
select pass('declining tells nobody else');
select pass('a declined player is routed to discovery');

select * from finish();

rollback;
