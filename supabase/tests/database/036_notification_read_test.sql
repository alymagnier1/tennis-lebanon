\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

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

-- ---------------------------------------------------------------------------
-- Reading a notification is scoped to its owner.
--
-- mark_notification_read filters on auth.uid() rather than raising, so a
-- mismatched id has to be checked by its effect: someone else's notification
-- must come back still unread.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_own_id uuid;
  v_other_id uuid;
begin
  insert into public.notifications (
    user_id, kind, entity_type, entity_id, deduplication_key, payload, scheduled_at
  )
  values (
    v_user_a, 'match_expired', 'match', gen_random_uuid(),
    'test:own:' || gen_random_uuid()::text, '{}'::jsonb, now()
  )
  returning id into v_own_id;

  insert into public.notifications (
    user_id, kind, entity_type, entity_id, deduplication_key, payload, scheduled_at
  )
  values (
    v_user_b, 'match_expired', 'match', gen_random_uuid(),
    'test:other:' || gen_random_uuid()::text, '{}'::jsonb, now()
  )
  returning id into v_other_id;

  set local role authenticated;
  perform pg_temp.set_caller(v_user_a);

  perform public.mark_notification_read(v_own_id);
  perform public.mark_notification_read(v_other_id);

  set local role postgres;

  perform pg_temp.assert_true(
    (select read_at from public.notifications where id = v_own_id) is not null,
    'a player should be able to mark their own notification read'
  );

  perform pg_temp.assert_true(
    (select read_at from public.notifications where id = v_other_id) is null,
    'marking another player notification read must have no effect'
  );

  set local role authenticated;
end;
$$;

select ok(true, 'mark_notification_read only touches the caller own notifications');

select * from finish();

rollback;
