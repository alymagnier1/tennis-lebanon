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

do $$
declare
  v_a uuid := '11111111-1111-1111-1111-111111111111';
  v_b uuid := '22222222-2222-2222-2222-222222222222';
  v_marked integer;
begin
  delete from public.notifications where user_id in (v_a, v_b);

  -- Two delivered and unread, one already read, one still in the outbox.
  insert into public.notifications
    (user_id, kind, entity_type, entity_id, deduplication_key, payload, scheduled_at, sent_at, read_at)
  values
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-1', '{}'::jsonb, now(), now(), null),
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-2', '{}'::jsonb, now(), now(), null),
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-3', '{}'::jsonb, now(), now(), now()),
    (v_a, 'match_message', 'match', gen_random_uuid(), 'test-a-4', '{}'::jsonb, now(), null, null),
    (v_b, 'match_message', 'match', gen_random_uuid(), 'test-b-1', '{}'::jsonb, now(), now(), null);

  perform set_config('request.jwt.claim.sub', v_a::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);

  v_marked := public.mark_all_notifications_read();

  perform pg_temp.assert_true(
    v_marked = 2,
    format('only the two delivered unread rows should move, got %s', v_marked)
  );

  perform pg_temp.assert_true(
    (select count(*) from public.notifications
     where user_id = v_a and sent_at is not null and read_at is null) = 0,
    'no delivered notification should be left unread'
  );

  -- Still in the outbox: marking it read would hide it before it was shown.
  perform pg_temp.assert_true(
    (select read_at from public.notifications
     where user_id = v_a and deduplication_key = 'test-a-4') is null,
    'an undelivered notification must not be marked read'
  );

  -- Another player's inbox is not ours to clear.
  perform pg_temp.assert_true(
    (select read_at from public.notifications
     where user_id = v_b and deduplication_key = 'test-b-1') is null,
    'marking all read must not touch another player'
  );
end;
$$;

select pass('only delivered unread rows are marked');
select pass('nothing delivered is left unread');
select pass('outbox rows are left alone');
select pass('another players notifications are untouched');

select * from finish();

rollback;
