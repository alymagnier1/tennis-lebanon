\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap;
select plan(5);

insert into public.prelaunch_signups
  (first_name, channel, contact, level, availability, consent_version, idempotency_key, status, created_at)
values
  ('Retention test', 'email', 'retention-four@example.com', 'intermediate', array['wd-ev'], 'beirut-prelaunch-v1', 'retention-four-117', 'waiting', now() - interval '4 months'),
  ('Retention test', 'email', 'retention-eleven@example.com', 'intermediate', array['wd-ev'], 'beirut-prelaunch-v2', 'retention-eleven-117', 'waiting', now() - interval '11 months'),
  ('Retention test', 'email', 'retention-thirteen@example.com', 'intermediate', array['wd-ev'], 'beirut-prelaunch-v1', 'retention-thirteen-117', 'waiting', now() - interval '13 months'),
  ('Retention test', 'email', 'retention-invited-year@example.com', 'intermediate', array['wd-ev'], 'beirut-prelaunch-v2', 'retention-invited-117', 'invited', now() - interval '13 months');

set local role service_role;
select lives_ok($$select public.prune_prelaunch_signups()$$, 'service role can run twelve-month cleanup');
reset role;
select is((select count(*) from public.prelaunch_signups where idempotency_key = 'retention-four-117'), 1::bigint, 'entries older than the previous three-month cutoff are kept');
select is((select count(*) from public.prelaunch_signups where idempotency_key = 'retention-eleven-117'), 1::bigint, 'eleven-month entries are kept');
select is((select count(*) from public.prelaunch_signups where idempotency_key = 'retention-thirteen-117'), 0::bigint, 'entries older than twelve months are removed');
select is((select count(*) from public.prelaunch_signups where idempotency_key = 'retention-invited-117'), 0::bigint, 'invitations do not extend the twelve-month retention');
select * from finish();
rollback;
