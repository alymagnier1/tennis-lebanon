begin;

create extension if not exists pgtap;
select plan(3);

-- `cron.job` is only read on the branch that runs, so an environment without
-- pg_cron skips instead of failing on a missing relation.
create or replace function pg_temp.sender_schedule()
returns setof text
language plpgsql
as $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return next skip('pg_cron is not installed here', 3);
    return;
  end if;

  return next is(
    (select count(*)::int from cron.job where jobname = 'tennis_process_notifications'),
    1,
    'exactly one sender job, not a second one beside the old schedule');

  return next is(
    (select schedule from cron.job where jobname = 'tennis_process_notifications'),
    '*/3 * * * *',
    'the sender runs every three minutes');

  return next ok(
    exists (
      select 1 from cron.job
      where jobname = 'tennis_process_notifications'
        and active
        and command = 'select public.invoke_process_notifications();'
    ),
    'the job is active and still calls the invoker');
end;
$$;

select * from pg_temp.sender_schedule();
select * from finish();

rollback;
