\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

set local role postgres;

do $$
declare
  v_match_id uuid := 'd5555555-5555-5555-5555-555555555555';
  v_expired integer;
  v_row record;
begin
  update public.matches
  set
    created_at = now() - interval '8 days',
    status = 'open',
    listing_extended_at = null
  where id = v_match_id;

  v_expired := public.expire_stale_matches();
  if v_expired < 1 then
    raise exception 'expected at least one expired match, got %', v_expired;
  end if;

  select *
  into v_row
  from public.matches
  where id = v_match_id;

  if v_row.status <> 'expired' then
    raise exception 'match should be expired';
  end if;

  update public.matches
  set
    created_at = now() - interval '6 days',
    status = 'open',
    listing_extended_at = null
  where id = v_match_id;

  update public.match_time_options
  set
    starts_at = now() + interval '3 days',
    ends_at = now() + interval '3 days 90 minutes'
  where match_id = v_match_id
    and withdrawn_at is null;

  perform pg_temp.set_caller('88888888-8888-8888-8888-888888888888');
  perform public.extend_match_listing(v_match_id);

  if not exists (
    select 1
    from public.list_my_matches() as lm
    where lm.match_id = v_match_id
      and lm.can_extend_listing = false
      and lm.is_stale_warning = false
  ) then
    raise exception 'extend should clear stale warning for listing window';
  end if;
end;
$$;

set local role authenticated;
select pass('match expiry and listing extend');

rollback;
