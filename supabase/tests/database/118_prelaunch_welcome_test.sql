\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap;
select plan(12);
insert into public.prelaunch_signups (first_name,channel,contact,level,availability,consent_version,idempotency_key,welcome_status)
values ('Welcome test','email','welcome118@example.com','intermediate',array['wd-ev'],'beirut-prelaunch-v3','welcome-test-118','pending'),
('Old form','email','old118@example.com','intermediate',array['wd-ev'],'beirut-prelaunch-v2','old-test-118','not_requested');
select is((select welcome_status from public.prelaunch_signups where idempotency_key='old-test-118'),'not_requested','old forms are not queued');
set local role anon;
select throws_ok($$select * from public.claim_prelaunch_welcome(null)$$,'42501',null,'anonymous cannot read or claim contacts');
reset role;
set local role authenticated;
select throws_ok($$select public.finish_prelaunch_welcome(gen_random_uuid(),gen_random_uuid(),'accepted')$$,'42501',null,'users cannot mark delivery');
reset role;
create temporary table welcome_claim as select * from public.claim_prelaunch_welcome('welcome-test-118');
select is((select count(*) from welcome_claim),1::bigint,'one job claimed');
select is((select count(*) from public.claim_prelaunch_welcome('welcome-test-118')),0::bigint,'active lease prevents overlapping sends');
select public.finish_prelaunch_welcome(id,gen_random_uuid(),'accepted') from welcome_claim;
select is((select welcome_status from public.prelaunch_signups where idempotency_key='welcome-test-118'),'sending','stale lease cannot acknowledge');
select public.finish_prelaunch_welcome(id,lease,'transient') from welcome_claim;
select is((select count(*) from public.claim_prelaunch_welcome('welcome-test-118')),0::bigint,'transient failure waits for backoff');
update public.prelaunch_signups set welcome_next_attempt_at=now()-interval '1 minute' where idempotency_key='welcome-test-118';
truncate welcome_claim;
insert into welcome_claim select * from public.claim_prelaunch_welcome('welcome-test-118');
select public.finish_prelaunch_welcome(id,lease,'accepted') from welcome_claim;
select is((select count(*) from public.claim_prelaunch_welcome('welcome-test-118')),0::bigint,'accepted jobs never resend');
update public.prelaunch_signups set welcome_status='pending',welcome_next_attempt_at=now(),welcome_first_attempt_at=now()-interval '23 hours 1 minute' where idempotency_key='welcome-test-118';
select is((select count(*) from public.claim_prelaunch_welcome('welcome-test-118')),0::bigint,'ambiguous sends are not retried beyond dedupe window');
select is((select welcome_status from public.prelaunch_signups where idempotency_key='welcome-test-118'),'failed','expired retries become terminal');
update public.prelaunch_signups set welcome_status='pending',welcome_first_attempt_at=now(),welcome_attempts=3 where idempotency_key='welcome-test-118';
select is((select count(*) from public.claim_prelaunch_welcome('welcome-test-118')),0::bigint,'three attempts is the hard cap');
set local role service_role;
select lives_ok($$select * from public.claim_prelaunch_welcome('missing-key')$$,'service role can dispatch');
reset role;
select * from finish();
rollback;
