-- Milestone 6.4: scheduled lifecycle jobs for in_progress transitions and booking nudges.

create or replace function public.start_in_progress_matches()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.matches as m
  set
    status = 'in_progress',
    updated_at = now()
  from public.bookings as b
  where b.match_id = m.id
    and m.status = 'confirmed'
    and b.status = 'accepted'
    and now() >= b.starts_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.booking_stale_reminders()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_club_nudges integer := 0;
  v_participant_notices integer := 0;
  v_row record;
  v_notification_id uuid;
begin
  for v_row in
    select
      b.id as booking_id,
      b.match_id,
      cm.user_id as staff_user_id
    from public.bookings as b
    join public.matches as m
      on m.id = b.match_id
    join public.courts as c
      on c.id = b.court_id
    join public.club_memberships as cm
      on cm.club_id = c.club_id
     and cm.is_active = true
     and cm.role in ('staff', 'admin')
    where b.status = 'requested'
      and m.status = 'booking_pending'
      and b.created_at <= now() - interval '4 hours'
      and b.created_at > now() - interval '24 hours'
  loop
    v_notification_id := public.enqueue_notification(
      v_row.staff_user_id,
      'booking_pending_club',
      'booking',
      v_row.booking_id,
      format('booking_pending_club:%s:%s', v_row.booking_id, v_row.staff_user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'Booking request waiting',
        'body', 'A court booking request needs a club response.'
      ),
      now()
    );

    if v_notification_id is not null then
      v_club_nudges := v_club_nudges + 1;
    end if;
  end loop;

  for v_row in
    select
      b.id as booking_id,
      b.match_id,
      mp.user_id
    from public.bookings as b
    join public.matches as m
      on m.id = b.match_id
    join public.match_participants as mp
      on mp.match_id = m.id
     and mp.status = 'accepted'
    where b.status = 'requested'
      and m.status = 'booking_pending'
      and b.created_at <= now() - interval '24 hours'
  loop
    v_notification_id := public.enqueue_notification(
      v_row.user_id,
      'booking_stale_participant',
      'booking',
      v_row.booking_id,
      format('booking_stale_participant:%s:%s', v_row.booking_id, v_row.user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'Still awaiting club',
        'body', 'Your booking request is still pending. Consider another club or withdrawing the request.'
      ),
      now()
    );

    if v_notification_id is not null then
      v_participant_notices := v_participant_notices + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'club_nudges_enqueued', v_club_nudges,
    'participant_notices_enqueued', v_participant_notices
  );
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
  v_booking_reminders jsonb;
begin
  v_stale_reminders := public.schedule_stale_match_reminders();
  v_expired_matches := public.expire_stale_matches();
  v_booking_reminders := public.booking_stale_reminders();

  return jsonb_build_object(
    'stale_reminders_enqueued', v_stale_reminders,
    'matches_expired', v_expired_matches,
    'booking_reminders', v_booking_reminders
  );
end;
$$;

revoke all on function public.start_in_progress_matches() from public, anon, authenticated;
revoke all on function public.booking_stale_reminders() from public, anon, authenticated;

grant execute on function public.start_in_progress_matches() to service_role;
grant execute on function public.booking_stale_reminders() to service_role;
grant execute on function public.enqueue_notification(uuid, text, text, uuid, text, jsonb, timestamptz) to service_role;

do $cron$
begin
  create extension if not exists pg_cron with schema extensions;
exception
  when insufficient_privilege then
    raise notice 'pg_cron extension unavailable in this environment';
  when undefined_file then
    raise notice 'pg_cron extension unavailable in this environment';
end;
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname in (
      'tennis_run_notification_jobs',
      'tennis_start_in_progress_matches'
    );

    perform cron.schedule(
      'tennis_run_notification_jobs',
      '0 * * * *',
      $$select public.run_notification_jobs();$$
    );

    perform cron.schedule(
      'tennis_start_in_progress_matches',
      '*/5 * * * *',
      $$select public.start_in_progress_matches();$$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron schema unavailable; schedule jobs manually or via edge cron';
  when undefined_function then
    raise notice 'pg_cron functions unavailable; schedule jobs manually or via edge cron';
end;
$cron$;
