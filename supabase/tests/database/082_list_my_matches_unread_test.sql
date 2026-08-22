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

create or replace function pg_temp.unread(p_match_id uuid)
returns integer
language sql
as $$
  select lm.unread_message_count
  from public.list_my_matches() as lm
  where lm.match_id = p_match_id;
$$;

do $$
declare
  v_a uuid := '11111111-1111-1111-1111-111111111111';
  v_b uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_old uuid;
  v_message uuid;
begin
  perform pg_temp.set_caller(v_a);

  for v_old in
    select lm.match_id from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft','open','full','ready_to_book','booking_pending','confirmed','in_progress')
  loop
    begin
      perform public.cancel_match(v_old, 'test cleanup');
    exception when others then null;
    end;
  end loop;

  v_match := public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'beginner'::public.skill_band,
    'competitive'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(jsonb_build_object(
      'starts_at', (now() + interval '3 days')::text,
      'ends_at', (now() + interval '3 days 90 minutes')::text)),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]);

  perform pg_temp.set_caller(v_b);
  perform public.join_match(v_match);

  -- B writes, so the count belongs to A and not to B.
  v_message := public.send_match_message(v_match, 'running ten minutes late');

  perform pg_temp.set_caller(v_a);
  perform pg_temp.assert_true(
    pg_temp.unread(v_match) = 1,
    format('A should see one unread, saw %s', pg_temp.unread(v_match))
  );

  perform pg_temp.set_caller(v_b);
  perform pg_temp.assert_true(
    pg_temp.unread(v_match) = 0,
    'an author must never see their own message as unread'
  );

  -- Reading clears it, and only for the reader.
  perform pg_temp.set_caller(v_a);
  perform public.mark_match_chat_read(v_match);
  perform pg_temp.assert_true(
    pg_temp.unread(v_match) = 0,
    'opening the chat should clear the count'
  );

  -- A deleted message is not something anyone still needs to read.
  perform pg_temp.set_caller(v_b);
  perform public.send_match_message(v_match, 'ignore that');
  update public.match_messages set deleted_at = now()
  where match_id = v_match and body = 'ignore that';

  perform pg_temp.set_caller(v_a);
  perform pg_temp.assert_true(
    pg_temp.unread(v_match) = 0,
    'a deleted message should not keep the badge lit'
  );
end;
$$;

select pass('unread counts messages from other participants');
select pass('an author never counts their own message');
select pass('reading the thread clears the count');
select pass('deleted messages do not count');

select * from finish();

rollback;
