\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

set local role postgres;

do $$
declare
  v_player_a uuid := '11111111-1111-1111-1111-111111111111';
  v_player_b uuid := '88888888-8888-8888-8888-888888888888';
  v_match_id uuid := 'd8888888-8888-8888-8888-888888888888';
  v_notification_id uuid;
  v_second_id uuid;
  v_claimed integer;
begin
  v_notification_id := public.enqueue_notification(
    v_player_a,
    'match_invitation',
    'match',
    v_match_id,
    'notification-outbox-test:invite:a',
    jsonb_build_object(
      'deepLink', format('/match/%s', v_match_id),
      'title', 'Invite',
      'body', 'You were invited'
    ),
    now()
  );

  if v_notification_id is null then
    raise exception 'enqueue should return notification id';
  end if;

  v_second_id := public.enqueue_notification(
    v_player_a,
    'match_invitation',
    'match',
    v_match_id,
    'notification-outbox-test:invite:a',
    jsonb_build_object('deepLink', '/match/x'),
    now()
  );

  if v_second_id is not null then
    raise exception 'deduplication key should prevent duplicate enqueue';
  end if;

  insert into public.device_push_tokens (user_id, device_id, token, platform)
  values (
    v_player_a,
    'notif-test-device',
    'ExponentPushToken[notiftesttoken123456]',
    'ios'
  )
  on conflict (user_id, device_id) do update
  set token = excluded.token, is_active = true, last_seen_at = now();

  -- Batch sized from what is actually pending rather than a fixed 10. A
  -- long-lived dev database carries a backlog, and this test's own notification
  -- simply fell outside the first ten -- a failure about queue depth, not about
  -- whether claiming works.
  select count(*)::integer
  into v_claimed
  from public.claim_due_notifications(
    greatest(
      (select count(*)::integer from public.notifications where sent_at is null),
      1
    )
  ) as c
  where c.notification_id = v_notification_id;

  if v_claimed <> 1 then
    raise exception 'claim should return due notification';
  end if;

  perform public.mark_notification_sent(v_notification_id);

  if not exists (
    select 1
    from public.notifications as n
    where n.id = v_notification_id
      and n.sent_at is not null
  ) then
    raise exception 'mark sent should stamp sent_at';
  end if;

  v_notification_id := public.enqueue_notification(
    v_player_b,
    'match_expired',
    'match',
    v_match_id,
    'notification-outbox-test:expired:b',
    jsonb_build_object('deepLink', format('/match/%s', v_match_id)),
    now()
  );

  for v_claimed in 1..3 loop
    update public.notifications as n
    set scheduled_at = now()
    where n.id = v_notification_id;

    -- Same reason as above: the claim has to reach this notification, and a
    -- fixed batch does not on a database with a backlog.
    perform public.claim_due_notifications(
      greatest(
        (select count(*)::integer from public.notifications where sent_at is null),
        1
      )
    );
    perform public.mark_notification_failed(v_notification_id, 'no_active_token');
  end loop;

  if not exists (
    select 1
    from public.notifications as n
    where n.id = v_notification_id
      and n.failed_at is not null
      and n.failure_code = 'no_active_token'
  ) then
    raise exception 'third failure should mark notification failed';
  end if;
end;
$$;

select pass('notification outbox enqueue claim and delivery state');

rollback;
