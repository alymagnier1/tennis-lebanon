-- Milestone 4: time voting, unanimous agreement, and ready_to_book transitions.

alter type public.match_hub_card
  add attribute selected_time_option_id uuid;

create or replace function public.match_active_time_option_count(p_match_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.match_time_options as mto
  where mto.match_id = p_match_id
    and mto.withdrawn_at is null
    and mto.ends_at > now();
$$;

create or replace function public.refresh_match_time_agreement(p_match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_capacity integer;
  v_accepted_count integer;
  v_unanimous_option uuid;
begin
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    return;
  end if;

  if v_match.status not in ('open', 'full', 'ready_to_book') then
    return;
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_accepted_count := public.match_participant_count(p_match_id);

  if v_accepted_count < v_capacity then
    if v_match.status = 'ready_to_book' then
      update public.matches
      set
        status = 'full',
        selected_time_option_id = null,
        updated_at = now()
      where id = p_match_id;
    end if;
    return;
  end if;

  select mto.id
  into v_unanimous_option
  from public.match_time_options as mto
  where mto.match_id = p_match_id
    and mto.withdrawn_at is null
    and mto.ends_at > now()
    and (
      select count(*)::integer
      from public.match_participants as mp
      where mp.match_id = p_match_id
        and mp.status = 'accepted'
    ) = (
      select count(*)::integer
      from public.match_time_votes as mtv
      join public.match_participants as mp
        on mp.user_id = mtv.user_id
       and mp.match_id = p_match_id
       and mp.status = 'accepted'
      where mtv.time_option_id = mto.id
        and mtv.vote = 'yes'
    )
  order by mto.starts_at
  limit 1;

  if v_unanimous_option is not null then
    update public.matches
    set
      status = 'ready_to_book',
      selected_time_option_id = v_unanimous_option,
      updated_at = now()
    where id = p_match_id
      and status in ('open', 'full', 'ready_to_book');
  elsif v_match.status = 'ready_to_book' then
    update public.matches
    set
      status = 'full',
      selected_time_option_id = null,
      updated_at = now()
    where id = p_match_id;
  end if;
end;
$$;

create or replace function public.cast_match_time_vote(
  p_match_id uuid,
  p_time_option_id uuid,
  p_vote public.vote_value
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.status not in ('open', 'full', 'ready_to_book') then
    raise exception using errcode = 'P0001', message = 'match_not_votable';
  end if;

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only accepted participants can vote';
  end if;

  if not exists (
    select 1
    from public.match_time_options as mto
    where mto.id = p_time_option_id
      and mto.match_id = p_match_id
      and mto.withdrawn_at is null
      and mto.ends_at > now()
  ) then
    raise exception using errcode = 'P0002', message = 'Time option not found';
  end if;

  insert into public.match_time_votes (
    time_option_id,
    user_id,
    vote
  )
  values (
    p_time_option_id,
    v_user_id,
    p_vote
  )
  on conflict (time_option_id, user_id)
  do update
  set
    vote = excluded.vote,
    updated_at = now();

  perform public.refresh_match_time_agreement(p_match_id);
end;
$$;

create or replace function public.withdraw_match_time_option(p_time_option_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  select mto.match_id
  into v_match_id
  from public.match_time_options as mto
  join public.matches as m
    on m.id = mto.match_id
  where mto.id = p_time_option_id
    and mto.withdrawn_at is null
    and m.creator_id = v_user_id
    and m.status in ('open', 'full', 'ready_to_book')
  for update of mto, m;

  if not found then
    raise exception using errcode = '42501', message = 'Only the creator can withdraw an active time option';
  end if;

  update public.match_time_options
  set withdrawn_at = now()
  where id = p_time_option_id;

  perform public.refresh_match_time_agreement(v_match_id);
end;
$$;

create or replace function public.add_match_time_option(
  p_match_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_option_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
    and m.creator_id = v_user_id
    and m.status in ('open', 'full', 'ready_to_book')
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Only the creator can add time options before booking';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at <= now() then
    raise exception using errcode = '22023', message = 'Invalid proposed time';
  end if;

  if public.match_active_time_option_count(p_match_id) >= 3 then
    raise exception using errcode = 'P0001', message = 'time_option_limit_reached';
  end if;

  insert into public.match_time_options (
    match_id,
    starts_at,
    ends_at,
    proposed_by
  )
  values (
    p_match_id,
    p_starts_at,
    p_ends_at,
    v_user_id
  )
  returning id into v_option_id;

  perform public.refresh_match_time_agreement(p_match_id);
  return v_option_id;
end;
$$;

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
  v_has_pending_requests boolean;
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

  if v_participant_status is null
     and v_match.visibility = 'public'
     and v_match.status in ('open', 'full', 'ready_to_book') then
    null;
  elsif v_participant_status is null then
    raise exception using errcode = '42501', message = 'Not authorized to view this match';
  end if;

  select exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'requested'
  )
  into v_has_pending_requests;

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
  v_card.notes := v_match.notes;
  v_card.creator_id := v_match.creator_id;
  v_card.participant_count := public.match_participant_count(v_match.id);
  v_card.capacity := public.match_capacity_for_format(v_match.format);
  v_card.selected_time_option_id := v_match.selected_time_option_id;
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
          'ends_at', mto.ends_at,
          'yes_count', (
            select count(*)::integer
            from public.match_time_votes as mtv
            join public.match_participants as mp
              on mp.user_id = mtv.user_id
             and mp.match_id = p_match_id
             and mp.status = 'accepted'
            where mtv.time_option_id = mto.id
              and mtv.vote = 'yes'
          ),
          'required_count', public.match_participant_count(p_match_id),
          'viewer_vote', (
            select mtv.vote::text
            from public.match_time_votes as mtv
            where mtv.time_option_id = mto.id
              and mtv.user_id = v_user_id
          )
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

  if v_is_creator and v_has_pending_requests and v_match.status in ('open', 'full') then
    v_card.next_action := 'manage_requests';
  elsif v_participant_status = 'accepted' and v_match.status = 'ready_to_book' then
    v_card.next_action := 'time_agreed';
  elsif v_participant_status = 'accepted' and v_match.status in ('open', 'full') then
    v_card.next_action := 'vote_on_times';
  elsif v_participant_status is null and v_match.status = 'open' then
    v_card.next_action := case
      when v_match.requires_creator_approval then 'request_to_join'
      else 'join_match'
    end;
  else
    v_card.next_action := 'view_match';
  end if;

  return v_card;
end;
$$;

revoke all on function public.match_active_time_option_count(uuid) from public, anon, authenticated;

revoke all on function public.refresh_match_time_agreement(uuid) from public, anon, authenticated;

revoke all on function public.cast_match_time_vote(uuid, uuid, public.vote_value) from public, anon;
grant execute on function public.cast_match_time_vote(uuid, uuid, public.vote_value) to authenticated;

revoke all on function public.withdraw_match_time_option(uuid) from public, anon;
grant execute on function public.withdraw_match_time_option(uuid) to authenticated;

revoke all on function public.add_match_time_option(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.add_match_time_option(uuid, timestamptz, timestamptz) to authenticated;

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

  if v_match.status not in ('open', 'full', 'ready_to_book') then
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
    set
      status = 'open',
      selected_time_option_id = null,
      updated_at = now()
    where id = p_match_id
      and status in ('full', 'ready_to_book');
  end if;

  perform public.refresh_match_time_agreement(p_match_id);
end;
$$;
