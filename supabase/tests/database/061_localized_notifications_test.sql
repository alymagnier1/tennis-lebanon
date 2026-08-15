\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(13);

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

create or replace function pg_temp.open_match(p_creator uuid)
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
    false,
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
-- Someone joining reaches the people already in the match, and not the joiner
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.open_match(v_creator);

  -- Publishing seats the creator as an accepted participant. Nobody else is in
  -- the match yet, so that must not have notified anyone.
  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_participant_joined', v_match) = 0,
    'seating the creator must not notify the creator'
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_participant_joined', v_match) = 1,
    'the host should be told a player joined'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_joiner, 'match_participant_joined', v_match) = 0,
    'the joiner should not be told about their own join'
  );
end;
$$;

select pass('joining notifies the existing roster');
select pass('joining does not notify the joiner');

-- ---------------------------------------------------------------------------
-- Leaving is the one that matters most, and it was silent
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.open_match(v_creator);

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);
  perform public.leave_match(v_match);

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_participant_left', v_match) = 1,
    'the host should be told a player left'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_joiner, 'match_participant_left', v_match) = 0,
    'the leaver should not be told about their own exit'
  );
end;
$$;

select pass('leaving notifies the remaining roster');
select pass('leaving does not notify the leaver');

-- ---------------------------------------------------------------------------
-- Chat: reach people once, not once per message
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.open_match(v_creator);

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);

  perform public.send_match_message(v_match, 'On my way');

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_message', v_match) = 1,
    'the other player should be told about a new message'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_joiner, 'match_message', v_match) = 0,
    'the author should not be notified of their own message'
  );

  -- A back-and-forth must not become a push per message.
  perform public.send_match_message(v_match, 'Actually running late');
  perform public.send_match_message(v_match, 'Ten minutes');

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_message', v_match) = 1,
    'messages inside one throttle window should collapse to a single notification'
  );

  -- The body is never carried into the payload: a lock-screen preview is the
  -- same exposure as logging it.
  perform pg_temp.assert_true(
    not exists (
      select 1
      from public.notifications as n
      where n.entity_id = v_match
        and n.kind = 'match_message'
        and n.payload::text ilike '%running late%'
    ),
    'message bodies must never reach the notification payload'
  );
end;
$$;

select pass('a new message notifies the other participants');
select pass('a message does not notify its author');
select pass('messages in one window collapse to a single notification');
select pass('message bodies stay out of the payload');

-- ---------------------------------------------------------------------------
-- Recipient language
-- ---------------------------------------------------------------------------

select has_column(
  'public',
  'profiles',
  'notification_locale',
  'profiles carries the UI language used for notification copy'
);

do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_other uuid := '22222222-2222-2222-2222-222222222222';
  v_before text;
begin
  select notification_locale into v_before
  from public.profiles where id = v_other;

  perform pg_temp.set_caller(v_user);
  perform public.set_own_notification_locale('ar');

  perform pg_temp.assert_true(
    (select notification_locale from public.profiles where id = v_user) = 'ar',
    'the caller''s own locale should be written'
  );

  perform pg_temp.assert_true(
    (select notification_locale from public.profiles where id = v_other)
      is not distinct from v_before,
    'setting a locale must not touch another player''s row'
  );

  -- Anything outside the supported set is rejected rather than stored, so the
  -- Edge Function never has to guess what a row means.
  begin
    perform public.set_own_notification_locale('de');
    raise exception 'unsupported locale should have been rejected';
  exception
    when sqlstate 'P0001' then
      null;
  end;
end;
$$;

select pass('set_own_notification_locale writes only the caller and rejects unknown locales');

-- The claim has to carry the language, or the Edge Function has nothing to pick
-- copy with and every push falls back to English.
do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_locale text;
begin
  perform pg_temp.set_caller(v_user);
  perform public.set_own_notification_locale('fr');

  perform public.enqueue_notification(
    v_user,
    'match_invitation',
    'match',
    null,
    'locale-claim-test',
    jsonb_build_object('deepLink', '/match/1'),
    now()
  );

  select c.locale into v_locale
  from public.claim_due_notifications(50) as c
  where c.notification_id = (
    select n.id from public.notifications as n
    where n.deduplication_key = 'locale-claim-test'
  );

  perform pg_temp.assert_true(
    v_locale = 'fr',
    'claim_due_notifications should report the recipient locale'
  );
end;
$$;

select pass('claim_due_notifications carries the recipient locale');

-- ---------------------------------------------------------------------------
-- Authorization
-- ---------------------------------------------------------------------------

select is(
  has_function_privilege(
    'authenticated',
    'public.notify_match_participants(uuid, text, uuid, text)',
    'execute'
  ),
  false,
  'players cannot fan out notifications to a match themselves'
);

select is(
  has_function_privilege(
    'anon',
    'public.set_own_notification_locale(text)',
    'execute'
  ),
  false,
  'anonymous callers cannot set a notification locale'
);

select * from finish();

rollback;
