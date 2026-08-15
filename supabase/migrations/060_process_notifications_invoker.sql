-- Milestone 8.13: actually invoke the notification sender.
--
-- Audit finding (recorded as a hard gate in docs/STAGING_CHECKLIST.md §7b):
-- nothing in this repository ever called the `process-notifications` Edge
-- Function. `pg_cron` ran only the database-side *enqueue* jobs, so every
-- reminder, club nudge and attendance prompt was written to the outbox and left
-- there. `claim_due_notifications` was never called, `sent_at` was never set,
-- and because the mobile notification centre lists only rows with a non-null
-- `sent_at`, the failure was invisible from inside the app: no error, no empty
-- outbox, just a list that stayed empty forever.
--
-- This adds the missing caller. `invoke_process_notifications` posts to the
-- Edge Function with the service role key, and pg_cron runs it every five
-- minutes.
--
-- The URL and the key are read from Vault rather than written here. A service
-- role key committed to a migration would be a secret in version control, and
-- the same migration has to run against local, staging and production, which
-- have different values. Create them once per environment:
--
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1/process-notifications',
--     'process_notifications_url',
--     'Edge Function endpoint invoked by tennis_process_notifications'
--   );
--   select vault.create_secret(
--     '<service-role-key>',
--     'process_notifications_token',
--     'Service role key used to authenticate the notification sender'
--   );
--
-- Until both exist the function is a no-op that raises a notice, so applying
-- this migration to an environment that has not been configured yet is safe and
-- does not start a failing cron job.

do $ext$
begin
  create extension if not exists pg_net;
exception
  when insufficient_privilege then
    raise notice 'pg_net extension unavailable in this environment';
  when undefined_file then
    raise notice 'pg_net extension unavailable in this environment';
end;
$ext$;

create or replace function public.invoke_process_notifications()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'process_notifications_url';

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'process_notifications_token';

  if v_url is null or v_token is null then
    -- Deliberately not an exception: a cron job that throws every five minutes
    -- in an unconfigured environment buries the signal it exists to carry.
    raise notice 'process-notifications not configured; add the vault secrets named in migration 060';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_request_id;

  return v_request_id;
exception
  when invalid_schema_name then
    raise notice 'pg_net is not installed; process-notifications was not invoked';
    return null;
  when undefined_function then
    raise notice 'net.http_post is unavailable; process-notifications was not invoked';
    return null;
  when undefined_table then
    raise notice 'vault is unavailable; process-notifications was not invoked';
    return null;
end;
$$;

-- Reads the service role key, so no client role may ever call it. pg_cron runs
-- as the job owner (postgres) and does not need an explicit grant.
revoke all on function public.invoke_process_notifications()
  from public, anon, authenticated, service_role;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'tennis_process_notifications';

    -- Five minutes: the outbox carries booking nudges and "did you play?"
    -- prompts, where an hour of lag is the difference between a useful nudge
    -- and a stale one. `claim_due_notifications` takes 50 rows per run and the
    -- Edge Function is idempotent per row, so overlapping runs are safe.
    perform cron.schedule(
      'tennis_process_notifications',
      '*/5 * * * *',
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
