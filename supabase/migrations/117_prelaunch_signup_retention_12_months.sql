-- Owner revised the unpublished v2 notice to 12 months on 10 October 2026.
-- Preserve migration 116 and its existing hourly cron schedule.
create or replace function public.prune_prelaunch_signups()
returns void
language sql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  delete from public.prelaunch_signups
  where created_at + interval '12 months' <= now();
$$;

revoke all on function public.prune_prelaunch_signups() from public, anon, authenticated;
grant execute on function public.prune_prelaunch_signups() to service_role;
