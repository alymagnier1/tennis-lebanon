\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(6);

insert into public.prelaunch_signups (
  first_name,
  channel,
  contact,
  level,
  availability,
  idempotency_key,
  consent_version
) values (
  'Rami',
  'whatsapp',
  '+96171123456',
  'intermediate',
  array['wd-ev']::text[],
  '11111111-1111-4111-8111-111111111111',
  'beirut-prelaunch-v1'
);

select throws_ok(
  $$
    insert into public.prelaunch_signups (
      first_name, channel, contact, level, availability, idempotency_key, consent_version
    ) values (
      'Rami', 'whatsapp', '+96171123456', 'intermediate', array['wd-ev']::text[],
      '22222222-2222-4222-8222-222222222222', 'beirut-prelaunch-v1'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "prelaunch_signups_community_contact"',
  'the same contact is one row'
);

select throws_ok(
  $$
    insert into public.prelaunch_signups (
      first_name, channel, contact, level, availability, idempotency_key, consent_version
    ) values (
      'Nour', 'email', 'nour@example.com', 'beginner', array['we-am']::text[],
      '11111111-1111-4111-8111-111111111111', 'beirut-prelaunch-v1'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "prelaunch_signups_idempotency_key"',
  'replaying an idempotency key does not insert again'
);

set local role anon;

select throws_ok(
  $$select count(*) from public.prelaunch_signups$$,
  '42501',
  'permission denied for table prelaunch_signups',
  'anon cannot read the waitlist'
);

select throws_ok(
  $$select * from public.list_prelaunch_signups('beirut')$$,
  '42501',
  'permission denied for function list_prelaunch_signups',
  'anon cannot call the operator list'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.list_prelaunch_signups('beirut')$$,
  '42501',
  'Platform operator role required',
  'a player cannot read the waitlist'
);

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);

select results_eq(
  $$select contact from public.list_prelaunch_signups('beirut')$$,
  $$select '+96171123456'::text$$,
  'a platform operator can read the contact'
);

select * from finish();
rollback;
