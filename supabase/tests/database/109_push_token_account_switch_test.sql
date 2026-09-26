begin;

create extension if not exists pgtap;
select plan(13);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

-- One phone, one Expo token, two accounts taking turns on it -- the staging
-- failure of 2026-09-26. The 020 test moved the first owner to a new token
-- before reassigning the old one, so the old row never held it and the
-- table-wide `unique(token)` never fired.
create or replace function pg_temp.push_token_account_switch()
returns setof text
language plpgsql
as $$
declare
  v_a uuid := '11111111-1111-1111-1111-111111111111';
  v_b uuid := '88888888-8888-8888-8888-888888888888';
  v_phone text := 'device-109-phone';
  v_reinstalled text := 'device-109-reinstalled';
  v_tablet text := 'device-109-tablet';
  v_token text := 'ExponentPushToken[109phonephonephone00]';
  v_tablet_token text := 'ExponentPushToken[109tablettablettab00]';
  v_first uuid;
  v_again uuid;
begin
  -- B's own tablet, which nothing below may touch.
  perform pg_temp.set_caller(v_b);
  perform public.register_device_push_token(v_tablet, v_tablet_token, 'android');

  -- -------------------------------------------------------------------------
  -- Sign out, then a different account signs in on the same phone.
  -- -------------------------------------------------------------------------

  perform pg_temp.set_caller(v_a);
  return next lives_ok(
    format(
      'select public.register_device_push_token(%L, %L, %L)',
      v_phone, v_token, 'android'),
    'A registers the phone');
  return next ok(
    public.deactivate_device_push_token(v_phone),
    'A signing out deactivates the phone');

  perform pg_temp.set_caller(v_b);
  return next lives_ok(
    format(
      'select public.register_device_push_token(%L, %L, %L)',
      v_phone, v_token, 'android'),
    'B signing in on the same phone registers the same token (was 23505)');
  return next ok(
    exists (
      select 1 from public.device_push_tokens
      where user_id = v_b and device_id = v_phone
        and token = v_token and is_active
    ),
    'B now owns the phone''s token, active');
  return next ok(
    not exists (
      select 1 from public.device_push_tokens
      where user_id = v_a and device_id = v_phone
    ),
    'A''s stale row for the phone is gone');

  -- -------------------------------------------------------------------------
  -- Back to A without B's sign-out reaching the server (offline sign-out).
  -- -------------------------------------------------------------------------

  perform pg_temp.set_caller(v_a);
  return next lives_ok(
    format(
      'select public.register_device_push_token(%L, %L, %L)',
      v_phone, v_token, 'android'),
    'A takes the phone back while B''s row is still active');
  return next ok(
    exists (
      select 1 from public.device_push_tokens
      where user_id = v_a and device_id = v_phone
        and token = v_token and is_active
    )
    and not exists (
      select 1 from public.device_push_tokens
      where user_id = v_b and token = v_token
    ),
    'the token follows the signed-in account, and B no longer holds it');

  -- -------------------------------------------------------------------------
  -- Same account, new install: the device id changes, the token does not.
  -- -------------------------------------------------------------------------

  return next lives_ok(
    format(
      'select public.register_device_push_token(%L, %L, %L)',
      v_reinstalled, v_token, 'android'),
    'a reinstall with a new device id registers the same token');
  return next is(
    (select count(*)::int from public.device_push_tokens where token = v_token),
    1,
    'exactly one row holds the token');
  return next ok(
    exists (
      select 1 from public.device_push_tokens
      where user_id = v_a and device_id = v_reinstalled and is_active
    ),
    'and it is the new install''s');

  -- -------------------------------------------------------------------------
  -- Unchanged behaviour.
  -- -------------------------------------------------------------------------

  v_first := public.register_device_push_token(v_reinstalled, v_token, 'android');
  v_again := public.register_device_push_token(v_reinstalled, v_token, 'android');
  return next is(
    v_again, v_first,
    'the same account re-registering the same device keeps its row');

  return next ok(
    exists (
      select 1 from public.device_push_tokens
      where user_id = v_b and device_id = v_tablet
        and token = v_tablet_token and is_active
    ),
    'another device''s row with a different token is untouched');

  perform pg_temp.set_caller(v_b);
  return next throws_ok(
    format(
      'select public.register_device_push_token(%L, %L, %L)',
      v_phone, 'short', 'android'),
    'P0001', 'Push token is invalid',
    'an invalid token is still rejected');
end;
$$;

select * from pg_temp.push_token_account_switch();
select * from finish();

rollback;
