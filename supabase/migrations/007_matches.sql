-- Milestone 3: match creation, join, invitations, and match hub.

create or replace function public.assert_marketplace_caller()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.assert_discovery_caller_eligible();
end;
$$;

create or replace function public.match_capacity_for_format(p_format public.match_format)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_format = 'singles' then 2 else 4 end;
$$;

create or replace function public.hash_invite_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.refresh_match_open_state(p_match_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
begin
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    return;
  end if;

  if v_match.status not in ('open', 'full') then
    return;
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_match_id);

  if v_count >= v_capacity then
    update public.matches
    set status = 'full', updated_at = now()
    where id = p_match_id
      and status = 'open';
  elsif v_count < v_capacity then
    update public.matches
    set status = 'open', updated_at = now()
    where id = p_match_id
      and status = 'full';
  end if;
end;
$$;

create or replace function public.assert_joinable_match(
  p_match_id uuid,
  p_viewer_id uuid,
  p_allow_non_public boolean default false
)
returns public.matches
language plpgsql
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_viewer_band public.skill_band;
begin
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.status not in ('open', 'full') then
    raise exception using errcode = 'P0001', message = 'match_not_joinable';
  end if;

  if not p_allow_non_public and v_match.visibility <> 'public' then
    raise exception using errcode = '42501', message = 'Match is not publicly joinable';
  end if;

  if public.is_blocked(p_viewer_id, v_match.creator_id) then
    raise exception using errcode = '42501', message = 'Blocked relationship';
  end if;

  select pp.skill_band
  into v_viewer_band
  from public.player_profiles as pp
  where pp.user_id = p_viewer_id;

  if public.skill_band_rank(v_viewer_band) < public.skill_band_rank(v_match.min_skill)
     or public.skill_band_rank(v_viewer_band) > public.skill_band_rank(v_match.max_skill) then
    raise exception using errcode = 'P0001', message = 'skill_out_of_range';
  end if;

  if not exists (
    select 1
    from public.match_time_options as mto
    where mto.match_id = p_match_id
      and mto.withdrawn_at is null
      and mto.ends_at > now()
  ) then
    raise exception using errcode = 'P0001', message = 'match_has_no_future_times';
  end if;

  return v_match;
end;
$$;

create or replace function public.create_and_publish_match(
  p_format public.match_format,
  p_visibility public.match_visibility,
  p_intent public.play_intent,
  p_min_skill public.skill_band,
  p_max_skill public.skill_band,
  p_requires_creator_approval boolean,
  p_notes text default null,
  p_zone_ids uuid[] default '{}'::uuid[],
  p_proposed_times jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match_id uuid;
  v_time record;
  v_time_count integer := 0;
begin
  v_user_id := public.assert_marketplace_caller();

  if public.skill_band_rank(p_min_skill) > public.skill_band_rank(p_max_skill) then
    raise exception using errcode = '22023', message = 'Invalid skill range';
  end if;

  if p_zone_ids is null or cardinality(p_zone_ids) = 0 then
    raise exception using errcode = '22023', message = 'At least one zone is required';
  end if;

  if jsonb_typeof(p_proposed_times) <> 'array'
     or jsonb_array_length(p_proposed_times) < 1
     or jsonb_array_length(p_proposed_times) > 3 then
    raise exception using errcode = '22023', message = 'Provide between 1 and 3 proposed times';
  end if;

  insert into public.matches (
    creator_id,
    format,
    visibility,
    status,
    intent,
    min_skill,
    max_skill,
    requires_creator_approval,
    notes
  )
  values (
    v_user_id,
    p_format,
    p_visibility,
    'open',
    p_intent,
    p_min_skill,
    p_max_skill,
    coalesce(p_requires_creator_approval, false),
    p_notes
  )
  returning id into v_match_id;

  insert into public.match_participants (
    match_id,
    user_id,
    status,
    is_creator,
    joined_at
  )
  values (
    v_match_id,
    v_user_id,
    'accepted',
    true,
    now()
  );

  insert into public.match_zones (match_id, zone_id)
  select v_match_id, zone_id
  from unnest(p_zone_ids) as zone_id;

  for v_time in
    select
      (value ->> 'starts_at')::timestamptz as starts_at,
      (value ->> 'ends_at')::timestamptz as ends_at
    from jsonb_array_elements(p_proposed_times)
  loop
    if v_time.starts_at is null
       or v_time.ends_at is null
       or v_time.ends_at <= v_time.starts_at
       or v_time.ends_at <= now() then
      raise exception using errcode = '22023', message = 'Invalid proposed time';
    end if;

    insert into public.match_time_options (
      match_id,
      starts_at,
      ends_at,
      proposed_by
    )
    values (
      v_match_id,
      v_time.starts_at,
      v_time.ends_at,
      v_user_id
    );

    v_time_count := v_time_count + 1;
  end loop;

  perform public.refresh_match_open_state(v_match_id);
  return v_match_id;
end;
$$;

create or replace function public.join_match(p_match_id uuid)
returns public.participant_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
  v_status public.participant_status;
begin
  v_user_id := public.assert_marketplace_caller();
  v_match := public.assert_joinable_match(p_match_id, v_user_id, false);

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'already_participant';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_match_id);

  if v_match.requires_creator_approval then
    v_status := 'requested';
  else
    if v_count >= v_capacity then
      raise exception using errcode = 'P0001', message = 'match_full';
    end if;
    v_status := 'accepted';
  end if;

  insert into public.match_participants (
    match_id,
    user_id,
    status,
    is_creator,
    joined_at
  )
  values (
    p_match_id,
    v_user_id,
    v_status,
    false,
    case when v_status = 'accepted' then now() else null end
  );

  if v_status = 'accepted' then
    perform public.refresh_match_open_state(p_match_id);
  end if;

  return v_status;
end;
$$;

create or replace function public.respond_to_join_request(
  p_match_id uuid,
  p_user_id uuid,
  p_accept boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
  v_format public.match_format;
  v_capacity integer;
  v_count integer;
begin
  v_creator_id := public.assert_marketplace_caller();

  perform public.assert_joinable_match(p_match_id, v_creator_id, true);

  if not exists (
    select 1
    from public.matches as m
    where m.id = p_match_id
      and m.creator_id = v_creator_id
  ) then
    raise exception using errcode = '42501', message = 'Only the creator can respond to join requests';
  end if;

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = p_user_id
      and mp.status = 'requested'
  ) then
    raise exception using errcode = 'P0002', message = 'Join request not found';
  end if;

  if p_accept then
    select m.format
    into v_format
    from public.matches as m
    where m.id = p_match_id;

    v_capacity := public.match_capacity_for_format(v_format);
    v_count := public.match_participant_count(p_match_id);

    if v_count >= v_capacity then
      raise exception using errcode = 'P0001', message = 'match_full';
    end if;

    update public.match_participants
    set status = 'accepted', joined_at = now()
    where match_id = p_match_id
      and user_id = p_user_id;

    perform public.refresh_match_open_state(p_match_id);
  else
    update public.match_participants
    set status = 'declined'
    where match_id = p_match_id
      and user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.leave_match(p_match_id uuid)
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

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = 'P0002', message = 'Not an active participant';
  end if;

  if exists (
    select 1
    from public.matches as m
    where m.id = p_match_id
      and m.status not in ('open', 'full')
  ) then
    raise exception using errcode = 'P0001', message = 'match_not_leavable';
  end if;

  update public.match_participants
  set status = 'left', left_at = now()
  where match_id = p_match_id
    and user_id = v_user_id;

  update public.match_invitations
  set revoked_at = now()
  where match_id = p_match_id
    and created_by = v_user_id
    and revoked_at is null;

  perform public.refresh_match_open_state(p_match_id);
end;
$$;

create or replace function public.cancel_match(
  p_match_id uuid,
  p_reason text default null
)
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

  if not exists (
    select 1
    from public.matches as m
    where m.id = p_match_id
      and m.creator_id = v_user_id
      and m.status in ('open', 'full')
  ) then
    raise exception using errcode = '42501', message = 'Only the creator can cancel an open match';
  end if;

  update public.matches
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    updated_at = now()
  where id = p_match_id;

  update public.match_invitations
  set revoked_at = now()
  where match_id = p_match_id
    and revoked_at is null;
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
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
  v_status public.participant_status;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_invite
  from public.match_invitations as mi
  where mi.token_hash = public.hash_invite_token(p_token)
    and mi.revoked_at is null
    and mi.accepted_at is null
    and mi.expires_at > now()
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Invite not found or expired';
  end if;

  if v_invite.invited_user_id is not null
     and v_invite.invited_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Invite is for another user';
  end if;

  v_match := public.assert_joinable_match(v_invite.match_id, v_user_id, true);

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = v_invite.match_id
      and mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'already_participant';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(v_invite.match_id);

  if v_count >= v_capacity then
    raise exception using errcode = 'P0001', message = 'match_full';
  end if;

  v_status := 'accepted';

  insert into public.match_participants (
    match_id,
    user_id,
    status,
    is_creator,
    joined_at
  )
  values (
    v_invite.match_id,
    v_user_id,
    v_status,
    false,
    now()
  );

  update public.match_invitations
  set accepted_at = now()
  where id = v_invite.id;

  perform public.refresh_match_open_state(v_invite.match_id);
  return v_invite.match_id;
end;
$$;

create type public.match_hub_card as (
  match_id uuid,
  format public.match_format,
  visibility public.match_visibility,
  status public.match_status,
  intent public.play_intent,
  min_skill public.skill_band,
  max_skill public.skill_band,
  requires_creator_approval boolean,
  notes text,
  creator_id uuid,
  creator_display_name text,
  participant_count integer,
  capacity integer,
  zones jsonb,
  proposed_times jsonb,
  participants jsonb,
  pending_requests jsonb,
  viewer_status public.participant_status,
  viewer_is_creator boolean,
  next_action text
);

create or replace function public.get_match_hub(p_match_id uuid)
returns public.match_hub_card
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_card public.match_hub_card;
  v_participant_status public.participant_status;
  v_is_creator boolean;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  select mp.status, mp.is_creator
  into v_participant_status, v_is_creator
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id
    and mp.status in ('accepted', 'requested', 'invited');

  if v_participant_status is null and v_match.visibility = 'public' and v_match.status in ('open', 'full') then
    null;
  elsif v_participant_status is null then
    raise exception using errcode = '42501', message = 'Not authorized to view this match';
  end if;

  select p.display_name
  into v_card.creator_display_name
  from public.profiles as p
  where p.id = v_match.creator_id;

  v_card.match_id := v_match.id;
  v_card.format := v_match.format;
  v_card.visibility := v_match.visibility;
  v_card.status := v_match.status;
  v_card.intent := v_match.intent;
  v_card.min_skill := v_match.min_skill;
  v_card.max_skill := v_match.max_skill;
  v_card.requires_creator_approval := v_match.requires_creator_approval;
  v_card.notes := case when v_participant_status = 'accepted' then v_match.notes else null end;
  v_card.creator_id := v_match.creator_id;
  v_card.participant_count := public.match_participant_count(v_match.id);
  v_card.capacity := public.match_capacity_for_format(v_match.format);
  v_card.zones := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', z.id, 'slug', z.slug, 'name_i18n', z.name_i18n)
      ),
      '[]'::jsonb
    )
    from public.match_zones as mz
    join public.zones as z on z.id = mz.zone_id
    where mz.match_id = v_match.id
  );
  v_card.proposed_times := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', mto.id,
          'starts_at', mto.starts_at,
          'ends_at', mto.ends_at
        )
        order by mto.starts_at
      ),
      '[]'::jsonb
    )
    from public.match_time_options as mto
    where mto.match_id = v_match.id
      and mto.withdrawn_at is null
      and mto.ends_at > now()
  );
  v_card.participants := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', p.id,
          'display_name', p.display_name,
          'status', mp.status,
          'is_creator', mp.is_creator
        )
        order by mp.is_creator desc, p.display_name
      ),
      '[]'::jsonb
    )
    from public.match_participants as mp
    join public.profiles as p on p.id = mp.user_id
    where mp.match_id = v_match.id
      and mp.status in ('accepted', 'requested', 'invited')
  );
  v_card.pending_requests := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', p.id,
          'display_name', p.display_name,
          'status', mp.status
        )
        order by mp.joined_at nulls last
      ),
      '[]'::jsonb
    )
    from public.match_participants as mp
    join public.profiles as p on p.id = mp.user_id
    where mp.match_id = v_match.id
      and mp.status = 'requested'
      and coalesce(v_is_creator, false)
  );
  v_card.viewer_status := v_participant_status;
  v_card.viewer_is_creator := coalesce(v_is_creator, false);

  if v_participant_status = 'accepted' and v_match.status in ('open', 'full') then
    v_card.next_action := 'vote_on_times';
  elsif v_participant_status is null and v_match.status = 'open' then
    v_card.next_action := case
      when v_match.requires_creator_approval then 'request_to_join'
      else 'join_match'
    end;
  elsif v_is_creator and v_match.status in ('open', 'full') then
    v_card.next_action := 'manage_requests';
  else
    v_card.next_action := 'view_match';
  end if;

  return v_card;
end;
$$;

create or replace function public.list_my_matches()
returns table (
  match_id uuid,
  format public.match_format,
  status public.match_status,
  visibility public.match_visibility,
  intent public.play_intent,
  participant_status public.participant_status,
  is_creator boolean,
  participant_count integer,
  capacity integer,
  soonest_time timestamptz,
  updated_at timestamptz
)
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
    m.id,
    m.format,
    m.status,
    m.visibility,
    m.intent,
    mp.status,
    mp.is_creator,
    public.match_participant_count(m.id),
    public.match_capacity_for_format(m.format),
    (
      select min(mto.starts_at)
      from public.match_time_options as mto
      where mto.match_id = m.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ),
    m.updated_at
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  where mp.user_id = v_user_id
    and mp.status in ('accepted', 'requested', 'invited')
    and m.status in ('open', 'full', 'ready_to_book', 'booking_pending', 'confirmed', 'in_progress')
  order by m.updated_at desc;
end;
$$;

revoke all on function public.assert_marketplace_caller() from public, anon;
grant execute on function public.assert_marketplace_caller() to authenticated;

revoke all on function public.create_and_publish_match(
  public.match_format,
  public.match_visibility,
  public.play_intent,
  public.skill_band,
  public.skill_band,
  boolean,
  text,
  uuid[],
  jsonb
) from public, anon;
grant execute on function public.create_and_publish_match(
  public.match_format,
  public.match_visibility,
  public.play_intent,
  public.skill_band,
  public.skill_band,
  boolean,
  text,
  uuid[],
  jsonb
) to authenticated;

revoke all on function public.join_match(uuid) from public, anon;
grant execute on function public.join_match(uuid) to authenticated;

revoke all on function public.respond_to_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.respond_to_join_request(uuid, uuid, boolean) to authenticated;

revoke all on function public.leave_match(uuid) from public, anon;
grant execute on function public.leave_match(uuid) to authenticated;

revoke all on function public.cancel_match(uuid, text) from public, anon;
grant execute on function public.cancel_match(uuid, text) to authenticated;

revoke all on function public.create_match_invite(uuid, uuid) from public, anon;
grant execute on function public.create_match_invite(uuid, uuid) to authenticated;

revoke all on function public.accept_match_invite(text) from public, anon;
grant execute on function public.accept_match_invite(text) to authenticated;

revoke all on function public.get_match_hub(uuid) from public, anon;
grant execute on function public.get_match_hub(uuid) to authenticated;

revoke all on function public.list_my_matches() from public, anon;
grant execute on function public.list_my_matches() to authenticated;
