\set ON_ERROR_STOP on

-- Migration 106 changed the rule this file asserts: "Mark all read" now clears
-- everything the player can see -- due and unread -- rather than delivered rows
-- only. Kept here, as the test for `mark_all_notifications_read`, rather than
-- split across two files that would disagree about the same function.

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

do $$
declare
  v_a uuid := '11111111-1111-1111-1111-111111111111';
  v_b uuid := '22222222-2222-2222-2222-222222222222';
  v_marked integer;
begin
  delete from public.notifications where user_id in (v_a, v_b);

  -- Two delivered and unread, one already read, one due but never sent, and
  -- one scheduled for tomorrow. Only the first two and the never-sent one are
  -- visible to the player today.
  insert into public.notifications
    (user_id, kind, entity_type, entity_id, deduplication_key, payload, scheduled_at, sent_at, read_at)
  values
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-1', '{}'::jsonb, now(), now(), null),
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-2', '{}'::jsonb, now(), now(), null),
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-3', '{}'::jsonb, now(), now(), now()),
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-4', '{}'::jsonb, now(), null, null),
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-5', '{}'::jsonb, now() + interval '1 day', null, null),
    (v_b, 'match_message', 'match', gen_random_uuid(), 'test-b-1', '{}'::jsonb, now(), now(), null);

  perform set_config('request.jwt.claim.sub', v_a::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);

  v_marked := public.mark_all_notifications_read();

  perform pg_temp.assert_true(
    v_marked = 3,
    format('the three due unread rows should move, got %s', v_marked)
  );

  -- The reason 106 exists: this row is what the centre shows and the bell
  -- counts while push is not delivering, and it used to be unclearable.
  perform pg_temp.assert_true(
    (select read_at from public.notifications
     where user_id = v_a and deduplication_key = 'test-a-4') is not null,
    'a due notification must clear even if it was never delivered'
  );

  perform pg_temp.assert_true(
    (select count(*) from public.notifications
     where user_id = v_a and scheduled_at <= now() and read_at is null) = 0,
    'nothing the player can see should be left unread'
  );

  -- Not visible yet, in the centre or on the bell. Clearing it would hide a
  -- reminder before it arrived.
  perform pg_temp.assert_true(
    (select read_at from public.notifications
     where user_id = v_a and deduplication_key = 'test-a-5') is null,
    'a notification scheduled for later must not be marked read'
  );

  -- Another player's inbox is not ours to clear.
  perform pg_temp.assert_true(
    (select read_at from public.notifications
     where user_id = v_b and deduplication_key = 'test-b-1') is null,
    'marking all read must not touch another player'
  );
end;
$$;

select pass('every due unread row is marked');
select pass('an undelivered row still clears');
select pass('nothing visible is left unread');
select pass('a future reminder is left alone');
select pass('another players notifications are untouched');

select * from finish();

rollback;
