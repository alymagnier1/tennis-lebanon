-- Milestone 6.2: register and deactivate Expo push tokens per user/device.

create or replace function public.assert_authenticated_caller()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status public.account_status;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select p.account_status
  into v_status
  from public.profiles as p
  where p.id = v_user_id;

  if not found or v_status in ('deleted', 'deletion_requested') then
    raise exception using errcode = '42501', message = 'Account unavailable';
  end if;

  return v_user_id;
end;
$$;

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

  update public.device_push_tokens as dpt
  set is_active = false
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

create or replace function public.deactivate_device_push_token(
  p_device_id text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_device_id text;
  v_updated integer;
begin
  v_user_id := public.assert_authenticated_caller();

  v_device_id := nullif(trim(coalesce(p_device_id, '')), '');
  if v_device_id is null or char_length(v_device_id) > 128 then
    raise exception using errcode = 'P0001', message = 'Device id must be between 1 and 128 characters';
  end if;

  update public.device_push_tokens as dpt
  set is_active = false,
      last_seen_at = now()
  where dpt.user_id = v_user_id
    and dpt.device_id = v_device_id
    and dpt.is_active = true;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.assert_authenticated_caller() from public, anon;
grant execute on function public.assert_authenticated_caller() to authenticated;

revoke all on function public.register_device_push_token(text, text, text) from public, anon;
grant execute on function public.register_device_push_token(text, text, text) to authenticated;

revoke all on function public.deactivate_device_push_token(text) from public, anon;
grant execute on function public.deactivate_device_push_token(text) to authenticated;
