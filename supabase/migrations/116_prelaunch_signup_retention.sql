-- Privacy notice v2: all waitlist entries expire three calendar months after signup.
-- Does not delete app accounts or profiles. Run before publishing the v2 notice.
create index prelaunch_signups_created_idx on public.prelaunch_signups (created_at);

create or replace function public.prune_prelaunch_signups()
returns void
language sql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  delete from public.prelaunch_signups
  where created_at + interval '3 months' <= now();
$$;

revoke all on function public.prune_prelaunch_signups() from public, anon, authenticated;
grant execute on function public.prune_prelaunch_signups() to service_role;

-- Fail closed if the scheduler is unavailable: the published promise depends on it.
do $cron$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is required for the three-month waitlist retention policy';
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'beirut_prune_signups';
  perform cron.schedule('beirut_prune_signups', '23 * * * *',
    'select public.prune_prelaunch_signups();');
end;
$cron$;
