-- Milestone 3.5 P1: stale match warnings, listing extend, and expiry job.

alter table public.matches
  add column if not exists listing_extended_at timestamptz;

create or replace function public.match_listing_anchor(p_created_at timestamptz, p_listing_extended_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_listing_extended_at, p_created_at);
$$;

create or replace function public.match_listing_expires_at(
  p_created_at timestamptz,
  p_listing_extended_at timestamptz
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select public.match_listing_anchor(p_created_at, p_listing_extended_at) + interval '7 days';
$$;

create or replace function public.match_all_times_passed_grace(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.match_time_options as mto
      where mto.match_id = p_match_id
        and mto.withdrawn_at is null
    )
    and not exists (
      select 1
      from public.match_time_options as mto
      where mto.match_id = p_match_id
        and mto.withdrawn_at is null
        and mto.ends_at > now() - interval '24 hours'
    );
$$;

create or replace function public.match_has_active_booking(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status in ('requested', 'alternative_proposed', 'accepted')
  );
$$;

create or replace function public.match_should_expire(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_listing_expires timestamptz;
begin
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    return false;
  end if;

  if v_match.status not in ('open', 'full') then
    return false;
  end if;

  if public.match_has_active_booking(p_match_id) then
    return false;
  end if;

  v_listing_expires := public.match_listing_expires_at(
    v_match.created_at,
    v_match.listing_extended_at
  );

  return public.match_all_times_passed_grace(p_match_id)
    or v_listing_expires <= now();
end;
$$;

create or replace function public.match_is_stale_warning(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_listing_expires timestamptz;
begin
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    return false;
  end if;

  if v_match.status not in ('open', 'full') then
    return false;
  end if;

  v_listing_expires := public.match_listing_expires_at(
    v_match.created_at,
    v_match.listing_extended_at
  );

  return v_listing_expires <= now() + interval '2 days'
    or public.match_all_times_passed_grace(p_match_id);
end;
$$;

create or replace function public.expire_stale_matches()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  update public.matches as m
  set
    status = 'expired',
    updated_at = now()
  where m.status in ('open', 'full')
    and public.match_should_expire(m.id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.extend_match_listing(p_match_id uuid)
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

  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the creator can extend this match';
  end if;

  if v_match.status not in ('open', 'full') then
    raise exception using errcode = 'P0001', message = 'Only open matches can be extended';
  end if;

  if not public.match_is_stale_warning(p_match_id) then
    raise exception using errcode = 'P0001', message = 'This match is not eligible for extension yet';
  end if;

  update public.matches
  set
    listing_extended_at = now(),
    updated_at = now()
  where id = p_match_id;
end;
$$;

drop function if exists public.list_my_matches();

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
  notes text,
  updated_at timestamptz,
  listing_expires_at timestamptz,
  is_stale_warning boolean,
  can_extend_listing boolean
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
    m.notes,
    m.updated_at,
    public.match_listing_expires_at(m.created_at, m.listing_extended_at),
    public.match_is_stale_warning(m.id),
    (
      mp.is_creator
      and m.status in ('open', 'full')
      and public.match_is_stale_warning(m.id)
    )
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  where mp.user_id = v_user_id
    and mp.status in ('accepted', 'requested', 'invited')
    and m.status in (
      'draft',
      'open',
      'full',
      'ready_to_book',
      'booking_pending',
      'confirmed',
      'in_progress'
    )
  order by m.updated_at desc;
end;
$$;

alter type public.match_hub_card
  add attribute listing_expires_at timestamptz,
  add attribute is_stale_warning boolean,
  add attribute can_extend_listing boolean;

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
  v_booking jsonb;
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

  select jsonb_build_object(
    'booking_id', b.id,
    'status', b.status,
    'court_id', b.court_id,
    'court_name', ct.name,
    'club_id', c.id,
    'club_name', c.name,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'price_minor', b.price_minor,
    'currency', b.currency,
    'payment_method', b.payment_method,
    'club_note', b.club_note,
    'proposed_court_id', b.proposed_court_id,
    'proposed_court_name', pct.name,
    'proposed_start_at', b.proposed_start_at,
    'proposed_end_at', b.proposed_end_at
  )
  into v_booking
  from public.bookings as b
  join public.courts as ct on ct.id = b.court_id
  join public.clubs as c on c.id = ct.club_id
  left join public.courts as pct on pct.id = b.proposed_court_id
  where b.match_id = p_match_id
    and b.status in ('requested', 'alternative_proposed', 'accepted')
  order by b.created_at desc
  limit 1;

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
  v_card.booking := v_booking;
  v_card.listing_expires_at := public.match_listing_expires_at(
    v_match.created_at,
    v_match.listing_extended_at
  );
  v_card.is_stale_warning := public.match_is_stale_warning(p_match_id);
  v_card.can_extend_listing := coalesce(v_is_creator, false)
    and v_match.status in ('open', 'full')
    and v_card.is_stale_warning;
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

  if v_is_creator and v_match.status = 'draft' then
    v_card.next_action := 'publish_match';
  elsif v_participant_status = 'accepted'
     and v_booking is not null
     and (v_booking->>'status') = 'alternative_proposed'
     and v_is_creator then
    v_card.next_action := 'review_alternative';
  elsif v_match.status = 'booking_pending' then
    v_card.next_action := 'awaiting_club';
  elsif v_match.status = 'confirmed' then
    v_card.next_action := 'pay_at_club';
  elsif v_is_creator and v_match.status = 'ready_to_book' then
    v_card.next_action := 'request_court';
  elsif v_participant_status = 'accepted' and v_match.status = 'ready_to_book' then
    v_card.next_action := 'time_agreed';
  elsif v_is_creator and v_has_pending_requests and v_match.status in ('open', 'full') then
    v_card.next_action := 'manage_requests';
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

revoke all on function public.expire_stale_matches() from public, anon, authenticated;
grant execute on function public.expire_stale_matches() to service_role;

revoke all on function public.extend_match_listing(uuid) from public, anon;
grant execute on function public.extend_match_listing(uuid) to authenticated;

revoke all on function public.list_my_matches() from public, anon;
grant execute on function public.list_my_matches() to authenticated;
