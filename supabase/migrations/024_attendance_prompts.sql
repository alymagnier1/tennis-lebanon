-- Milestone 7.2: attendance prompt notifications after match start.

create or replace function public.schedule_attendance_prompts()
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
    join public.bookings as b
      on b.match_id = m.id
     and b.status = 'accepted'
    join public.match_participants as mp
      on mp.match_id = m.id
     and mp.status = 'accepted'
    where m.status = 'in_progress'
      and now() >= b.starts_at
      and mp.attendance = 'unknown'
  loop
    v_notification_id := public.enqueue_notification(
      v_row.user_id,
      'attendance_prompt',
      'match',
      v_row.match_id,
      format('attendance_prompt:%s:%s', v_row.match_id, v_row.user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'How did the match go?',
        'body', 'Confirm your attendance and submit the result when you are ready.'
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
  v_attendance_prompts integer;
begin
  v_stale_reminders := public.schedule_stale_match_reminders();
  v_expired_matches := public.expire_stale_matches();
  v_booking_reminders := public.booking_stale_reminders();
  v_attendance_prompts := public.schedule_attendance_prompts();

  return jsonb_build_object(
    'stale_reminders_enqueued', v_stale_reminders,
    'matches_expired', v_expired_matches,
    'booking_reminders', v_booking_reminders,
    'attendance_prompts_enqueued', v_attendance_prompts
  );
end;
$$;

revoke all on function public.schedule_attendance_prompts() from public, anon, authenticated;
grant execute on function public.schedule_attendance_prompts() to service_role;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname in (
      'tennis_run_notification_jobs',
      'tennis_start_in_progress_matches',
      'tennis_schedule_attendance_prompts'
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

    perform cron.schedule(
      'tennis_schedule_attendance_prompts',
      '*/15 * * * *',
      $$select public.schedule_attendance_prompts();$$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron schema unavailable; schedule attendance prompts manually or via edge cron';
  when undefined_function then
    raise notice 'pg_cron functions unavailable; schedule attendance prompts manually or via edge cron';
end;
$cron$;
