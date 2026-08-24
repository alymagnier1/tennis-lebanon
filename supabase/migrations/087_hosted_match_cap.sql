-- Three matches on the go, whatever they are.
--
-- The cap has been rewritten twice in two days and both times the rule was
-- harder to say than to enforce. `012` allowed one hosted match per format;
-- `085` narrowed that to one *public listing* per format so a private "ask this
-- player to play" would stop dead-ending. Two rules, a visibility subtlety, and
-- a banner nobody could write an honest sentence for.
--
-- Replaced by one rule with one number: at most three active hosted matches,
-- counting drafts, across both formats and both visibilities. It bounds the
-- Discover clutter `012` was written for -- a host can list at most three --
-- without needing to explain what "listed" means, and it is short enough to
-- put in a banner: "You have 3 matches on the go. Cancel one to start another."
--
-- Paired with a product change: invites into an existing match now live only on
-- that match's own invite screen, so Discover and player profiles always create.
-- That makes creating the common action, and a count is the right shape of
-- limit for a common action in a way that a per-format exclusion never was.
--
-- `publish_match` keeps a guard but can no longer fire in normal use: the draft
-- being published was already counted when it was created, so the count cannot
-- rise here. It stays as defence in depth against a row that reached `draft`
-- some other way.
--
-- Bodies are `085` verbatim -- itself `045` and `033` verbatim -- with only the
-- guard replaced. Diffed against the live definitions before copying.

-- Kept in one place: `match_cap_reached` is what the client maps to its copy.
create or replace function public.hosted_match_cap()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 3;
$$;

create or replace function public.create_match_draft(
  p_format public.match_format,
  p_visibility public.match_visibility,
  p_intent public.play_intent,
  p_min_skill public.skill_band,
  p_max_skill public.skill_band,
  p_requires_creator_approval boolean,
  p_notes text default null,
  p_zone_ids uuid[] default '{}'::uuid[],
  p_proposed_times jsonb default '[]'::jsonb,
  p_timing_mode text default 'fixed',
  p_preferred_club_ids uuid[] default '{}'::uuid[]
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
  v_timing_mode text;
  v_time_count integer;
  v_club_ids uuid[];
begin
  v_user_id := public.assert_marketplace_caller();
  v_timing_mode := coalesce(nullif(trim(p_timing_mode), ''), 'fixed');

  if v_timing_mode not in ('fixed', 'flexible') then
    raise exception using errcode = '22023', message = 'Unsupported timing mode';
  end if;

  if (
    select count(*)
    from public.matches as m
    where m.creator_id = v_user_id
      and m.status in ('draft', 'open', 'full', 'ready_to_book')
  ) >= public.hosted_match_cap() then
    raise exception using errcode = 'P0001', message = 'match_cap_reached';
  end if;

  if public.skill_band_rank(p_min_skill) > public.skill_band_rank(p_max_skill) then
    raise exception using errcode = '22023', message = 'Invalid skill range';
  end if;

  if p_zone_ids is null or cardinality(p_zone_ids) = 0 then
    raise exception using errcode = '22023', message = 'At least one zone is required';
  end if;

  perform public.assert_active_zones(p_zone_ids);

  -- Duplicates would collide with the composite primary key, and the host
  -- tapping the same club twice is a UI slip rather than an error worth showing.
  select coalesce(array_agg(distinct club_id), '{}'::uuid[])
  into v_club_ids
  from unnest(coalesce(p_preferred_club_ids, '{}'::uuid[])) as club_id;

  if cardinality(v_club_ids) > 3 then
    raise exception using errcode = '22023', message = 'At most three preferred clubs';
  end if;

  -- A public listing that names only a zone leaves a joiner deciding whether to
  -- drive without knowing where. Private and invite-only matches are among
  -- people who already know, so they may skip it.
  if p_visibility = 'public' and cardinality(v_club_ids) = 0 then
    raise exception using errcode = '22023', message = 'preferred_club_required';
  end if;

  if exists (
    select 1
    from unnest(v_club_ids) as club_id
    where not exists (
      select 1
      from public.clubs as c
      where c.id = club_id
        and c.is_active = true
    )
  ) then
    raise exception using errcode = 'P0002', message = 'Preferred club not found';
  end if;

  if jsonb_typeof(p_proposed_times) <> 'array' then
    raise exception using errcode = '22023', message = 'Proposed times must be an array';
  end if;

  v_time_count := jsonb_array_length(p_proposed_times);

  if v_timing_mode = 'fixed' then
    if v_time_count <> 1 then
      raise exception using errcode = '22023', message = 'A fixed match needs exactly one time';
    end if;
  elsif v_time_count < 1 or v_time_count > 3 then
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
    notes,
    timing_mode
  )
  values (
    v_user_id,
    p_format,
    p_visibility,
    'draft',
    p_intent,
    p_min_skill,
    p_max_skill,
    coalesce(p_requires_creator_approval, false),
    p_notes,
    v_timing_mode
  )
  returning id into v_match_id;

  insert into public.match_participants (
    match_id,
    user_id,
    status,
    is_creator,
    joined_at
  )
  values (v_match_id, v_user_id, 'accepted', true, now());

  insert into public.match_zones (match_id, zone_id)
  select v_match_id, zone_id
  from unnest(p_zone_ids) as zone_id;

  insert into public.match_preferred_clubs (match_id, club_id)
  select v_match_id, club_id
  from unnest(v_club_ids) as club_id;

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
    values (v_match_id, v_time.starts_at, v_time.ends_at, v_user_id);
  end loop;

  return v_match_id;
end;
$$;

create or replace function public.publish_match(p_match_id uuid)
returns void
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
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the creator can publish this match';
  end if;

  if v_match.status <> 'draft' then
    return;
  end if;

  -- Counts everything except this draft, which was already counted at create
  -- time. Unreachable while every match arrives through create_match_draft.
  if (
    select count(*)
    from public.matches as m
    where m.creator_id = v_user_id
      and m.id <> p_match_id
      and m.status in ('draft', 'open', 'full', 'ready_to_book')
  ) >= public.hosted_match_cap() then
    raise exception using errcode = 'P0001', message = 'match_cap_reached';
  end if;

  select mto.id
  into v_option_id
  from public.match_time_options as mto
  where mto.match_id = p_match_id
    and mto.withdrawn_at is null
    and mto.ends_at > now()
  order by mto.starts_at
  limit 1;

  if v_option_id is null then
    raise exception using errcode = '22023', message = 'Invalid proposed time';
  end if;

  update public.matches
  set
    status = 'open',
    -- A fixed match carries its agreed time from the moment it goes live.
    selected_time_option_id = case
      when v_match.timing_mode = 'fixed' then v_option_id
      else selected_time_option_id
    end,
    updated_at = now()
  where id = p_match_id;

  perform public.refresh_match_open_state(p_match_id);
end;
$$;

revoke all on function public.hosted_match_cap() from public, anon;
grant execute on function public.hosted_match_cap() to authenticated;

revoke all on function public.create_match_draft(
  public.match_format,
  public.match_visibility,
  public.play_intent,
  public.skill_band,
  public.skill_band,
  boolean,
  text,
  uuid[],
  jsonb,
  text,
  uuid[]
) from public, anon;
grant execute on function public.create_match_draft(
  public.match_format,
  public.match_visibility,
  public.play_intent,
  public.skill_band,
  public.skill_band,
  boolean,
  text,
  uuid[],
  jsonb,
  text,
  uuid[]
) to authenticated;

revoke all on function public.publish_match(uuid) from public, anon;
grant execute on function public.publish_match(uuid) to authenticated;
