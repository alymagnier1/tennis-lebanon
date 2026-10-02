-- Serialize the rolling eight-per-hour limit. No raw address or contact is stored here.
-- Keep 114 immutable; this migration can follow it on existing installations.
create index prelaunch_signup_attempts_created_idx
  on public.prelaunch_signup_attempts (created_at);

create or replace function public.consume_prelaunch_signup_attempt(p_ip_hash text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_count integer;
  v_oldest timestamptz;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid address hash';
  end if;
  -- Transaction lock is held through the count and insert, including concurrent calls.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('beirut:' || p_ip_hash, 0));
  v_now := clock_timestamp();
  select count(*)::integer, min(created_at) into v_count, v_oldest
  from public.prelaunch_signup_attempts
  where ip_hash = p_ip_hash and created_at > v_now - interval '1 hour';
  if v_count >= 8 then
    return greatest(1, ceil(extract(epoch from v_oldest + interval '1 hour' - v_now))::integer);
  end if;
  insert into public.prelaunch_signup_attempts (ip_hash, created_at) values (p_ip_hash, v_now);
  return 0;
end;
$$;
revoke all on function public.consume_prelaunch_signup_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_prelaunch_signup_attempt(text) to service_role;
-- Explicit grants avoid depending on the project's default table privileges.
grant insert on public.prelaunch_signups to service_role;

create or replace function public.prune_prelaunch_signup_attempts()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.prelaunch_signup_attempts where created_at < now() - interval '24 hours';
$$;
revoke all on function public.prune_prelaunch_signup_attempts() from public, anon, authenticated;
grant execute on function public.prune_prelaunch_signup_attempts() to service_role;

-- Existing local/hosted setup installs pg_cron in 022. Verify this job before launch.
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'beirut_prune_signup_attempts';
    perform cron.schedule('beirut_prune_signup_attempts', '17 * * * *',
      'select public.prune_prelaunch_signup_attempts();');
  else
    raise warning 'Before accepting signups, schedule prune_prelaunch_signup_attempts hourly; pg_cron is unavailable';
  end if;
end;
$cron$;
