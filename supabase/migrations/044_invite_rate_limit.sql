-- docs/TESTING_SECURITY.md:71 specifies 20 invitations per user per day. It was
-- never implemented, so a single account could enumerate the whole player base
-- with invites, each one arriving as a notification.
--
-- Counts match_invitations directly rather than adding a log table: created_by
-- and created_at are already there, and a separate log would need its own
-- retention and could drift from what was actually sent. Revoked and expired
-- invites still count, because sending is the action being limited.
--
-- Shape follows enforce_discovery_rate_limit (004_discovery.sql:110), including
-- the hardcoded ceiling. Reading these from platform_policy_settings is a
-- separate piece of work that should move all of them at once.

create or replace function public.enforce_invite_rate_limit(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_recent_count integer;
begin
  select count(*)
  into v_recent_count
  from public.match_invitations as mi
  where mi.created_by = p_user_id
    and mi.created_at > now() - interval '1 day';

  if v_recent_count >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'invite_rate_limited';
  end if;
end;
$$;

revoke all on function public.enforce_invite_rate_limit(uuid) from public, anon, authenticated;

create or replace function public.create_match_invite(
  p_match_id uuid,
  p_invited_user_id uuid default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_token text;
  v_token_hash text;
begin
  v_user_id := public.assert_marketplace_caller();

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only participants can invite';
  end if;

  if p_invited_user_id is not null
     and public.is_blocked(v_user_id, p_invited_user_id) then
    raise exception using errcode = '42501', message = 'Blocked relationship';
  end if;

  -- After authorization, so someone with no business here is turned away for
  -- that reason rather than being told about the quota.
  perform public.enforce_invite_rate_limit(v_user_id);

  if p_invited_user_id is not null then
    update public.match_invitations as mi
    set revoked_at = now()
    where mi.match_id = p_match_id
      and mi.invited_user_id = p_invited_user_id
      and mi.revoked_at is null
      and mi.accepted_at is null;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := public.hash_invite_token(v_token);

  insert into public.match_invitations (
    match_id,
    invited_user_id,
    token_hash,
    created_by,
    expires_at
  )
  values (
    p_match_id,
    p_invited_user_id,
    v_token_hash,
    v_user_id,
    now() + interval '14 days'
  );

  return v_token;
end;
$$;
