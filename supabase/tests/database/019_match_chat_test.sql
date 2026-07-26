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

set local role authenticated;

do $$
declare
  v_match_id uuid := 'd8888888-8888-8888-8888-888888888888';
  v_message_id uuid;
  v_failed boolean;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_failed := false;
  begin
    perform public.send_match_message(v_match_id, 'hello from non-participant');
    v_failed := true;
  exception
    when others then
      null;
  end;
  if v_failed then
    raise exception 'non-participant should not send chat';
  end if;

  perform pg_temp.set_caller('88888888-8888-8888-8888-888888888888');
  v_message_id := public.send_match_message(v_match_id, 'See you on court');

  if not exists (
    select 1
    from public.list_match_messages(v_match_id) as m
    where m.message_id = v_message_id
      and m.body = 'See you on court'
  ) then
    raise exception 'participant should read own message';
  end if;

  perform pg_temp.set_caller('14141414-1414-1414-1414-141414141414');
  if not exists (
    select 1
    from public.list_match_messages(v_match_id) as m
    where m.message_id = v_message_id
  ) then
    raise exception 'other accepted participant should read message';
  end if;
end;
$$;

select pass('match chat participant access');

rollback;
