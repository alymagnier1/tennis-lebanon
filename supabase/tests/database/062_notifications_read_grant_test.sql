\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(7);

-- The grant the notification centre needs. Without it PostgREST is rejected
-- before RLS is ever consulted, which is what made the screen error rather than
-- show an empty list.
select is(
  has_table_privilege('authenticated', 'public.notifications', 'SELECT'),
  true,
  'players can read the notifications table'
);

select is(
  has_table_privilege('anon', 'public.notifications', 'SELECT'),
  false,
  'signed-out callers cannot read notifications'
);

-- Reads only. The outbox is written by enqueue_notification and the delivery
-- jobs; a player marking one read goes through mark_notification_read.
select is(
  has_table_privilege('authenticated', 'public.notifications', 'INSERT'),
  false,
  'players cannot write into the notification outbox'
);

select is(
  has_table_privilege('authenticated', 'public.notifications', 'UPDATE'),
  false,
  'players cannot update notifications directly'
);

select is(
  has_table_privilege('authenticated', 'public.notifications', 'DELETE'),
  false,
  'players cannot delete notifications'
);

-- A table grant is not a licence to read everyone's mail: the grant only makes
-- the existing RLS policy reachable, and that policy still binds to the caller.
do $$
declare
  v_mine uuid := '11111111-1111-1111-1111-111111111111';
  v_theirs uuid := '22222222-2222-2222-2222-222222222222';
  v_visible integer;
  v_foreign integer;
begin
  perform public.enqueue_notification(
    v_mine, 'match_invitation', 'match', null,
    'grant-test-mine', jsonb_build_object('deepLink', '/match/1'), now()
  );
  perform public.enqueue_notification(
    v_theirs, 'match_invitation', 'match', null,
    'grant-test-theirs', jsonb_build_object('deepLink', '/match/2'), now()
  );

  perform set_config('request.jwt.claim.sub', v_mine::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_visible
  from public.notifications
  where deduplication_key = 'grant-test-mine';

  select count(*) into v_foreign
  from public.notifications
  where deduplication_key = 'grant-test-theirs';

  reset role;

  if v_visible <> 1 then
    raise exception 'a player should see their own notification (saw %)', v_visible;
  end if;

  if v_foreign <> 0 then
    raise exception 'a player must not see another player''s notification (saw %)', v_foreign;
  end if;
end;
$$;

select pass('a player sees their own notifications');
select pass('the grant does not expose another player''s notifications');

select * from finish();

rollback;
