-- Milestone 6.3: notification outbox, delivery claims, and stale/expired enqueue.

alter table public.notifications
  add column if not exists attempt_count integer not null default 0;

create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_deduplication_key text,
  p_payload jsonb default '{}'::jsonb,
  p_scheduled_at timestamptz default now()
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
  v_kind text;
  v_dedup_key text;
begin
  v_kind := nullif(trim(coalesce(p_kind, '')), '');
  v_dedup_key := nullif(trim(coalesce(p_deduplication_key, '')), '');

  if v_kind is null or char_length(v_kind) > 80 then
    raise exception using errcode = 'P0001', message = 'Notification kind is invalid';
  end if;

  if v_dedup_key is null or char_length(v_dedup_key) > 200 then
    raise exception using errcode = 'P0001', message = 'Deduplication key is invalid';
  end if;

  insert into public.notifications (
    user_id,
    kind,
    entity_type,
    entity_id,
    deduplication_key,
    payload,
    scheduled_at
  )
  values (
    p_user_id,
    v_kind,
    nullif(trim(coalesce(p_entity_type, '')), ''),
    p_entity_id,
    v_dedup_key,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_scheduled_at, now())
  )
  on conflict (deduplication_key) do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

create or replace function public.claim_due_notifications(p_limit integer default 50)
returns table (
  notification_id uuid,
  user_id uuid,
  kind text,
  payload jsonb,
  push_tokens text[],
  attempt_count integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  return query
  with due as (
    select n.id
    from public.notifications as n
    where n.sent_at is null
      and n.failed_at is null
      and n.scheduled_at <= now()
      and n.attempt_count < 3
    order by n.scheduled_at, n.created_at
    limit v_limit
    for update skip locked
  ),
  bumped as (
    update public.notifications as n
    set attempt_count = n.attempt_count + 1
    from due as d
    where n.id = d.id
    returning n.id, n.user_id, n.kind, n.payload, n.attempt_count
  )
  select
    b.id,
    b.user_id,
    b.kind,
    b.payload,
    coalesce(
      array_agg(dpt.token order by dpt.last_seen_at desc)
        filter (where dpt.token is not null),
      '{}'::text[]
    ),
    b.attempt_count
  from bumped as b
  left join public.device_push_tokens as dpt
    on dpt.user_id = b.user_id
   and dpt.is_active = true
  group by b.id, b.user_id, b.kind, b.payload, b.attempt_count;
end;
$$;

create or replace function public.mark_notification_sent(p_notification_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.notifications as n
  set sent_at = now()
  where n.id = p_notification_id
    and n.sent_at is null
    and n.failed_at is null;
end;
$$;

create or replace function public.mark_notification_failed(
  p_notification_id uuid,
  p_failure_code text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_attempt_count integer;
  v_failure_code text;
begin
  v_failure_code := left(nullif(trim(coalesce(p_failure_code, '')), ''), 80);

  select n.attempt_count
  into v_attempt_count
  from public.notifications as n
  where n.id = p_notification_id;

  if not found then
    return;
  end if;

  if v_attempt_count >= 3 then
    update public.notifications as n
    set
      failed_at = now(),
      failure_code = coalesce(v_failure_code, 'delivery_failed')
    where n.id = p_notification_id
      and n.sent_at is null
      and n.failed_at is null;
  else
    update public.notifications as n
    set
      scheduled_at = now() + make_interval(mins => 5 * v_attempt_count),
      failure_code = coalesce(v_failure_code, 'delivery_failed')
    where n.id = p_notification_id
      and n.sent_at is null
      and n.failed_at is null;
  end if;
end;
$$;

create or replace function public.schedule_stale_match_reminders()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row record;
  v_notification_id uuid;
begin
  for v_row in
    select
      m.id as match_id,
      mp.user_id
    from public.matches as m
    join public.match_participants as mp
      on mp.match_id = m.id
     and mp.status = 'accepted'
    where m.status in ('open', 'full')
      and public.match_is_stale_warning(m.id)
      and not public.match_has_active_booking(m.id)
  loop
    v_notification_id := public.enqueue_notification(
      v_row.user_id,
      'stale_match_reminder',
      'match',
      v_row.match_id,
      format('stale_match_reminder:%s:%s', v_row.match_id, v_row.user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'Match listing expiring soon',
        'body', 'Extend your listing if you are still looking for players.'
      ),
      now()
    );

    if v_notification_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.expire_stale_matches()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select m.id as match_id
    from public.matches as m
    where m.status in ('open', 'full')
      and public.match_should_expire(m.id)
  loop
    perform public.enqueue_notification(
      mp.user_id,
      'match_expired',
      'match',
      v_row.match_id,
      format('match_expired:%s:%s', v_row.match_id, mp.user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'Match expired',
        'body', 'This match listing has expired and is no longer open.'
      ),
      now()
    )
    from public.match_participants as mp
    where mp.match_id = v_row.match_id
      and mp.status = 'accepted';
  end loop;

  update public.matches as m
  set
    status = 'expired',
    updated_at = now()
  where m.status in ('open', 'full')
    and public.match_should_expire(m.id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.create_match_invite(
  p_match_id uuid,
  p_invited_user_id uuid default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_token text;
  v_token_hash text;
  v_invitation_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  if not exists (
    select 1
    from public.matches as m
    where m.id = p_match_id
      and m.status in ('draft', 'open', 'full')
  ) then
    raise exception using errcode = 'P0001', message = 'match_not_invitable';
  end if;

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only participants can invite';
  end if;

  if p_invited_user_id is not null
     and public.is_blocked(v_user_id, p_invited_user_id) then
    raise exception using errcode = '42501', message = 'Blocked relationship';
  end if;

  if p_invited_user_id is not null then
    update public.match_invitations as mi
    set revoked_at = now()
    where mi.match_id = p_match_id
      and mi.invited_user_id = p_invited_user_id
      and mi.revoked_at is null
      and mi.accepted_at is null;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := public.hash_invite_token(v_token);

  insert into public.match_invitations (
    match_id,
    invited_user_id,
    token_hash,
    created_by,
    expires_at
  )
  values (
    p_match_id,
    p_invited_user_id,
    v_token_hash,
    v_user_id,
    now() + interval '14 days'
  )
  returning id into v_invitation_id;

  if p_invited_user_id is not null then
    perform public.enqueue_notification(
      p_invited_user_id,
      'match_invitation',
      'match',
      p_match_id,
      format('match_invitation:%s', v_invitation_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', p_match_id),
        'title', 'New match invitation',
        'body', 'Open the app to view and respond to your invitation.'
      ),
      now()
    );
  end if;

  return v_token;
end;
$$;

create or replace function public.run_notification_jobs()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stale_reminders integer;
  v_expired_matches integer;
begin
  v_stale_reminders := public.schedule_stale_match_reminders();
  v_expired_matches := public.expire_stale_matches();

  return jsonb_build_object(
    'stale_reminders_enqueued', v_stale_reminders,
    'matches_expired', v_expired_matches
  );
end;
$$;

revoke all on function public.enqueue_notification(uuid, text, text, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_due_notifications(integer) from public, anon, authenticated;
revoke all on function public.mark_notification_sent(uuid) from public, anon, authenticated;
revoke all on function public.mark_notification_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.schedule_stale_match_reminders() from public, anon, authenticated;
revoke all on function public.run_notification_jobs() from public, anon, authenticated;

grant execute on function public.claim_due_notifications(integer) to service_role;
grant execute on function public.mark_notification_sent(uuid) to service_role;
grant execute on function public.mark_notification_failed(uuid, text) to service_role;
grant execute on function public.schedule_stale_match_reminders() to service_role;
grant execute on function public.run_notification_jobs() to service_role;

revoke all on function public.create_match_invite(uuid, uuid) from public, anon;
grant execute on function public.create_match_invite(uuid, uuid) to authenticated;
