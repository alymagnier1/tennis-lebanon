-- Milestone 3.5: in-app match invite inbox, accept/decline by id, singles first-accept-wins.

create type public.match_invite_inbox_row as (
  invitation_id uuid,
  match_id uuid,
  format public.match_format,
  match_status public.match_status,
  creator_display_name text,
  inviter_display_name text,
  participant_count integer,
  capacity integer,
  soonest_time timestamptz,
  expires_at timestamptz,
  created_at timestamptz
);

create or replace function public.revoke_pending_targeted_invites(
  p_match_id uuid,
  p_except_invitation_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.match_invitations as mi
  set revoked_at = now()
  where mi.match_id = p_match_id
    and mi.invited_user_id is not null
    and mi.revoked_at is null
    and mi.accepted_at is null
    and (p_except_invitation_id is null or mi.id <> p_except_invitation_id);
end;
$$;

create or replace function public.apply_match_invitation_acceptance(
  p_invite public.match_invitations,
  p_user_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
  v_status public.participant_status;
  v_count_after integer;
begin
  if p_invite.revoked_at is not null
     or p_invite.accepted_at is not null
     or p_invite.expires_at <= now() then
    raise exception using errcode = 'P0002', message = 'Invite not found or expired';
  end if;

  if p_invite.invited_user_id is not null
     and p_invite.invited_user_id <> p_user_id then
    raise exception using errcode = '42501', message = 'Invite is for another user';
  end if;

  v_match := public.assert_joinable_match(p_invite.match_id, p_user_id, true);

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_invite.match_id
      and mp.user_id = p_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'already_participant';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_invite.match_id);

  if v_count >= v_capacity then
    raise exception using errcode = 'P0001', message = 'match_full';
  end if;

  v_status := 'accepted';

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_invite.match_id
      and mp.user_id = p_user_id
      and mp.status in ('left', 'declined', 'removed')
  ) then
    update public.match_participants
    set
      status = v_status,
      joined_at = now(),
      left_at = null
    where match_id = p_invite.match_id
      and user_id = p_user_id;
  else
    insert into public.match_participants (
      match_id,
      user_id,
      status,
      is_creator,
      joined_at
    )
    values (
      p_invite.match_id,
      p_user_id,
      v_status,
      false,
      now()
    );
  end if;

  update public.match_invitations
  set accepted_at = now()
  where id = p_invite.id;

  perform public.refresh_match_open_state(p_invite.match_id);

  v_count_after := public.match_participant_count(p_invite.match_id);

  if v_count_after >= v_capacity then
    perform public.revoke_pending_targeted_invites(p_invite.match_id, p_invite.id);
  end if;

  return p_invite.match_id;
end;
$$;

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

create or replace function public.accept_match_invite(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_invite public.match_invitations%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_invite
  from public.match_invitations as mi
  where mi.token_hash = public.hash_invite_token(p_token)
  for update;

  return public.apply_match_invitation_acceptance(v_invite, v_user_id);
end;
$$;

create or replace function public.accept_match_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_invite public.match_invitations%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_invite
  from public.match_invitations as mi
  where mi.id = p_invitation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Invite not found or expired';
  end if;

  return public.apply_match_invitation_acceptance(v_invite, v_user_id);
end;
$$;

create or replace function public.decline_match_invitation(p_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  update public.match_invitations as mi
  set revoked_at = now()
  where mi.id = p_invitation_id
    and mi.invited_user_id = v_user_id
    and mi.revoked_at is null
    and mi.accepted_at is null
    and mi.expires_at > now();

  if not found then
    raise exception using errcode = 'P0002', message = 'Invite not found or expired';
  end if;
end;
$$;

create or replace function public.list_my_match_invites()
returns setof public.match_invite_inbox_row
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  return query
  select
    mi.id,
    m.id,
    m.format,
    m.status,
    creator_profile.display_name,
    inviter_profile.display_name,
    public.match_participant_count(m.id),
    public.match_capacity_for_format(m.format),
    (
      select min(mto.starts_at)
      from public.match_time_options as mto
      where mto.match_id = m.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ),
    mi.expires_at,
    mi.created_at
  from public.match_invitations as mi
  join public.matches as m on m.id = mi.match_id
  join public.profiles as creator_profile on creator_profile.id = m.creator_id
  join public.profiles as inviter_profile on inviter_profile.id = mi.created_by
  where mi.invited_user_id = v_user_id
    and mi.revoked_at is null
    and mi.accepted_at is null
    and mi.expires_at > now()
    and m.status in ('open', 'full')
    and public.match_participant_count(m.id)
      < public.match_capacity_for_format(m.format)
    and not exists (
      select 1
      from public.match_participants as mp
      where mp.match_id = m.id
        and mp.user_id = v_user_id
        and mp.status in ('accepted', 'requested', 'invited')
    )
  order by mi.created_at desc;
end;
$$;

revoke all on function public.revoke_pending_targeted_invites(uuid, uuid) from public, anon, authenticated;

revoke all on function public.apply_match_invitation_acceptance(public.match_invitations, uuid) from public, anon, authenticated;

revoke all on function public.accept_match_invitation(uuid) from public, anon;
grant execute on function public.accept_match_invitation(uuid) to authenticated;

revoke all on function public.decline_match_invitation(uuid) from public, anon;
grant execute on function public.decline_match_invitation(uuid) to authenticated;

revoke all on function public.list_my_match_invites() from public, anon;
grant execute on function public.list_my_match_invites() to authenticated;
