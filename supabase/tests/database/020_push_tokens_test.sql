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
  v_player_a uuid := '11111111-1111-1111-1111-111111111111';
  v_player_b uuid := '88888888-8888-8888-8888-888888888888';
  v_device_a text := 'device-a-020';
  v_device_b text := 'device-b-020';
  v_token_a text := 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
  v_token_b text := 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';
  v_row_id uuid;
  v_failed boolean;
begin
  perform pg_temp.set_caller(v_player_a);
  v_row_id := public.register_device_push_token(v_device_a, v_token_a, 'ios');

  perform public.register_device_push_token(
    v_device_a,
    'ExponentPushToken[cccccccccccccccccccccc]',
    'android'
  );

  perform pg_temp.set_caller(v_player_b);
  perform public.register_device_push_token(v_device_b, v_token_a, 'android');

  perform pg_temp.set_caller(v_player_a);
  if not public.deactivate_device_push_token(v_device_a) then
    raise exception 'deactivate should return true when token existed';
  end if;

  v_failed := false;
  begin
    perform public.register_device_push_token(v_device_a, v_token_b, 'desktop');
    v_failed := true;
  exception
    when others then
      null;
  end;
  if v_failed then
    raise exception 'invalid platform should be rejected';
  end if;

  perform pg_temp.set_caller(v_player_b);
  if public.deactivate_device_push_token(v_device_a) then
    raise exception 'caller should not deactivate another user device token';
  end if;
end;
$$;

set local role postgres;

do $$
declare
  v_player_a uuid := '11111111-1111-1111-1111-111111111111';
  v_player_b uuid := '88888888-8888-8888-8888-888888888888';
  v_device_a text := 'device-a-020';
  v_device_b text := 'device-b-020';
  v_token_a text := 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
begin
  if not exists (
    select 1
    from public.device_push_tokens as dpt
    where dpt.user_id = v_player_b
      and dpt.device_id = v_device_b
      and dpt.token = v_token_a
      and dpt.platform = 'android'
      and dpt.is_active = true
  ) then
    raise exception 'token reassignment should activate new owner row';
  end if;

  if exists (
    select 1
    from public.device_push_tokens as dpt
    where dpt.user_id = v_player_a
      and dpt.device_id = v_device_a
      and dpt.is_active = true
  ) then
    raise exception 'deactivate should mark token inactive';
  end if;
end;
$$;

select pass('push token register and deactivate');

rollback;
