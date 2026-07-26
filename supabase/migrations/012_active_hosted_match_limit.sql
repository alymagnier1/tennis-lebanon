-- P0: one active hosted match per format; cancel through ready_to_book.

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

  if exists (
    select 1
    from public.matches as m
    where m.creator_id = v_user_id
      and m.format = p_format
      and m.status in ('open', 'full', 'ready_to_book')
  ) then
    raise exception using errcode = 'P0001', message = 'active_hosted_match_exists';
  end if;

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
      and m.status in ('open', 'full', 'ready_to_book')
  ) then
    raise exception using errcode = '42501', message = 'Only the creator can cancel a match before booking';
  end if;

  update public.matches
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    selected_time_option_id = null,
    updated_at = now()
  where id = p_match_id;

  update public.match_invitations
  set revoked_at = now()
  where match_id = p_match_id
    and revoked_at is null;
end;
$$;
