\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(4);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $sql$select public.submit_user_report('harassment', 'self report', '11111111-1111-1111-1111-111111111111')$sql$,
  'P0001',
  'You cannot report yourself',
  'users cannot report themselves'
);

select lives_ok(
  $sql$select public.submit_user_report('harassment', 'Inappropriate messages', '88888888-8888-8888-8888-888888888888')$sql$,
  'player can submit a user report'
);

select throws_ok(
  $sql$select public.submit_user_report('harassment', 'duplicate', '88888888-8888-8888-8888-888888888888')$sql$,
  'P0001',
  'report_rate_limited',
  'duplicate report within 24 hours is rejected'
);

set local role postgres;

do $$
declare
  v_report_id uuid;
begin
  select ur.id
  into v_report_id
  from public.user_reports as ur
  order by ur.created_at desc
  limit 1;

  perform pg_temp.set_caller('55555555-5555-5555-5555-555555555555');

  if not exists (
    select 1
    from public.list_open_user_reports() as row
    where row.report_id = v_report_id
  ) then
    raise exception 'open report should appear in operator queue';
  end if;

  perform public.resolve_user_report(
    v_report_id,
    'dismiss',
    'No policy violation found'
  );

  if exists (
    select 1
    from public.user_reports as ur
    where ur.id = v_report_id
      and ur.status = 'open'
  ) then
    raise exception 'resolved report should leave open queue';
  end if;

  if not exists (
    select 1
    from public.audit_events as ae
    where ae.entity_id = v_report_id
      and ae.action = 'user_report_resolved'
  ) then
    raise exception 'report resolution should create audit event';
  end if;
end;
$$;

select pass('platform report queue and resolution');

rollback;
