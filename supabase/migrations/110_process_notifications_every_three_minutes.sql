-- The notification sender runs every three minutes instead of five.
--
-- A push reaches a phone up to one sender interval after it is due, before
-- Expo and Android add their own delay. Five minutes (060) was felt in the
-- 2026-09-26 rehearsal: the bell in the app lit minutes before the phone
-- buzzed. Three minutes was the founder's choice, 2026-09-26 -- 480 runs a day
-- instead of 288. Nothing else changes: `claim_due_notifications` takes 50
-- rows per run and the Edge Function is idempotent per row, so overlapping
-- runs stay safe.
--
-- Same guarded shape as 060, so environments without pg_cron still get a
-- notice rather than a failed migration.

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'tennis_process_notifications';

    perform cron.schedule(
      'tennis_process_notifications',
      '*/3 * * * *',
      $$select public.invoke_process_notifications();$$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron schema unavailable; invoke process-notifications externally';
  when undefined_function then
    raise notice 'pg_cron functions unavailable; invoke process-notifications externally';
end;
$cron$;
