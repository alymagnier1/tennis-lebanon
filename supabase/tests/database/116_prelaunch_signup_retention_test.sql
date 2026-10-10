\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap;
select plan(7);

insert into public.prelaunch_signups
  (first_name, channel, contact, level, availability, consent_version, idempotency_key, status, created_at)
values
  ('Retention test', 'email', 'retention-old@example.com', 'intermediate', array['wd-ev'], 'beirut-prelaunch-v1', 'retention-old-116', 'waiting', now() - interval '13 months'),
  ('Retention test', 'email', 'retention-invited@example.com', 'intermediate', array['wd-ev'], 'beirut-prelaunch-v2', 'retention-invited-116', 'invited', now() - interval '13 months'),
  ('Retention test', 'email', 'retention-current@example.com', 'intermediate', array['wd-ev'], 'beirut-prelaunch-v2', 'retention-current-116', 'waiting', now() - interval '2 months');

set local role anon;
select throws_ok($$select public.prune_prelaunch_signups()$$, '42501', 'permission denied for function prune_prelaunch_signups', 'anonymous callers cannot delete the waitlist');
set local role authenticated;
select throws_ok($$select public.prune_prelaunch_signups()$$, '42501', 'permission denied for function prune_prelaunch_signups', 'players cannot delete the waitlist');
set local role service_role;
select lives_ok($$select public.prune_prelaunch_signups()$$, 'service role can run cleanup');
reset role;

select is((select count(*) from public.prelaunch_signups where idempotency_key = 'retention-old-116'), 0::bigint, 'expired v1 entry is removed');
select is((select count(*) from public.prelaunch_signups where idempotency_key = 'retention-invited-116'), 0::bigint, 'an invitation does not extend retention');
select is((select count(*) from public.prelaunch_signups where idempotency_key = 'retention-current-116'), 1::bigint, 'current entry is preserved');
select is((select count(*) from cron.job where jobname = 'beirut_prune_signups' and schedule = '23 * * * *' and active), 1::bigint, 'one active hourly cleanup is scheduled');
select * from finish();
rollback;
