\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(6);

-- Structure.
select has_function(
  'public',
  'invoke_process_notifications',
  array[]::text[],
  'invoke_process_notifications exists'
);

select function_returns(
  'public',
  'invoke_process_notifications',
  array[]::text[],
  'bigint',
  'invoke_process_notifications returns the pg_net request id'
);

-- Authorization. The function reads the service role key out of Vault, so a
-- client role being able to call it would be a key disclosure, not merely a
-- privilege slip.
select is(
  has_function_privilege(
    'authenticated',
    'public.invoke_process_notifications()',
    'execute'
  ),
  false,
  'authenticated cannot invoke the notification sender'
);

select is(
  has_function_privilege(
    'anon',
    'public.invoke_process_notifications()',
    'execute'
  ),
  false,
  'anon cannot invoke the notification sender'
);

select is(
  has_function_privilege(
    'service_role',
    'public.invoke_process_notifications()',
    'execute'
  ),
  false,
  'service_role cannot invoke the notification sender'
);

-- Unconfigured environments must degrade to a notice, not a failing cron job
-- that fires every five minutes. Local test runs have no vault secrets, which
-- is exactly the path being asserted here.
select is(
  public.invoke_process_notifications(),
  null,
  'returns null instead of raising when the vault secrets are absent'
);

select * from finish();

rollback;
