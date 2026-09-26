-- A phone that switches accounts must keep receiving push for whoever is
-- signed in.
--
-- An Expo push token belongs to one app install, and `device_push_tokens` has
-- a table-wide `unique(token)`. `register_device_push_token` (020) handled a
-- token turning up under another account or device id by switching the old
-- row off -- but an inactive row still holds the token, so the insert for the
-- new owner then failed with `23505` on `device_push_tokens_token_key`.
--
-- Reproduced on staging 2026-09-26: a phone signed out (its row deactivated),
-- signed in with a different Google account 14 seconds later, and the
-- registration came back 409. That account had no token, and the phone
-- received no push from then on. The 020 test missed it because it moved the
-- first owner to a new token before reassigning the old one.
--
-- The stale row is now deleted rather than deactivated. It describes an
-- install that no longer exists under that account; nothing reads inactive
-- rows, account deletion already removes them (102), and keeping one would
-- only keep blocking the token. The caller's own row for this device is still
-- upserted, so the same account re-registering is unchanged.
--
-- No data fix: a phone stuck this way heals on its next sync, which runs on
-- sign-in and whenever the app returns to the foreground.

create or replace function public.register_device_push_token(
  p_device_id text,
  p_token text,
  p_platform text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_device_id text;
  v_token text;
  v_platform text;
  v_row_id uuid;
begin
  v_user_id := public.assert_authenticated_caller();

  v_device_id := nullif(trim(coalesce(p_device_id, '')), '');
  if v_device_id is null or char_length(v_device_id) > 128 then
    raise exception using errcode = 'P0001', message = 'Device id must be between 1 and 128 characters';
  end if;

  v_token := nullif(trim(coalesce(p_token, '')), '');
  if v_token is null or char_length(v_token) < 10 or char_length(v_token) > 512 then
    raise exception using errcode = 'P0001', message = 'Push token is invalid';
  end if;

  v_platform := lower(nullif(trim(coalesce(p_platform, '')), ''));
  if v_platform not in ('ios', 'android') then
    raise exception using errcode = 'P0001', message = 'Platform must be ios or android';
  end if;

  delete from public.device_push_tokens as dpt
  where dpt.token = v_token
    and (dpt.user_id <> v_user_id or dpt.device_id <> v_device_id);

  insert into public.device_push_tokens (
    user_id,
    device_id,
    token,
    platform,
    is_active,
    last_seen_at
  )
  values (
    v_user_id,
    v_device_id,
    v_token,
    v_platform,
    true,
    now()
  )
  on conflict (user_id, device_id) do update
  set
    token = excluded.token,
    platform = excluded.platform,
    is_active = true,
    last_seen_at = now()
  returning id into v_row_id;

  return v_row_id;
end;
$$;

revoke all on function public.register_device_push_token(text, text, text) from public, anon;
grant execute on function public.register_device_push_token(text, text, text) to authenticated;
