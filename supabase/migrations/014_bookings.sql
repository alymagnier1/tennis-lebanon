-- Milestone 5: manual court booking requests, favourites, and hub booking summary.

alter table public.bookings
  add column if not exists proposed_court_id uuid references public.courts(id),
  add column if not exists proposed_start_at timestamptz,
  add column if not exists proposed_end_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_proposed_time_check;

alter table public.bookings
  add constraint bookings_proposed_time_check
  check (
    proposed_start_at is null
    or (
      proposed_end_at is not null
      and proposed_end_at > proposed_start_at
      and proposed_court_id is not null
    )
  );

create table if not exists public.player_favorite_clubs (
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id)
);

alter table public.player_favorite_clubs enable row level security;

revoke all on table public.player_favorite_clubs from public, anon;
grant select, insert, delete on table public.player_favorite_clubs to authenticated;

create policy player_favorite_clubs_manage_own on public.player_favorite_clubs
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter type public.match_hub_card
  add attribute booking jsonb;

create or replace function public.is_club_staff(p_club_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_memberships as cm
    where cm.club_id = p_club_id
      and cm.user_id = p_user_id
      and cm.is_active = true
      and cm.role in ('staff', 'admin')
  );
$$;

create or replace function public.assert_club_staff(p_club_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not public.is_club_staff(p_club_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Not authorized for this club';
  end if;

  return v_user_id;
end;
$$;

create or replace function public.court_has_block(
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.court_blocks as cb
    where cb.court_id = p_court_id
      and tstzrange(cb.starts_at, cb.ends_at, '[)') &&
          tstzrange(p_starts_at, p_ends_at, '[)')
  );
$$;

create or replace function public.append_booking_event(
  p_booking_id uuid,
  p_from_status public.booking_status,
  p_to_status public.booking_status,
  p_actor_id uuid,
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.booking_events (
    booking_id,
    from_status,
    to_status,
    actor_id,
    reason,
    payload
  )
  values (
    p_booking_id,
    p_from_status,
    p_to_status,
    p_actor_id,
    p_reason,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

create or replace function public.list_clubs_directory(p_zone_ids uuid[] default null)
returns table (
  club_id uuid,
  name text,
  slug text,
  description text,
  address_public text,
  zone_id uuid,
  zone_slug text,
  zone_name_i18n jsonb,
  latitude numeric,
  longitude numeric,
  booking_mode text,
  amenities text[],
  court_count integer,
  min_price_minor integer,
  currency char(3),
  is_favorite boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_discovery_caller_eligible();

  return query
  select
    c.id,
    c.name,
    c.slug,
    c.description,
    c.address_public,
    c.zone_id,
    z.slug,
    z.name_i18n,
    c.latitude,
    c.longitude,
    c.booking_mode,
    c.amenities,
    (
      select count(*)::integer
      from public.courts as ct
      where ct.club_id = c.id
        and ct.is_active = true
    ),
    (
      select min(ct.price_minor)
      from public.courts as ct
      where ct.club_id = c.id
        and ct.is_active = true
        and ct.price_minor is not null
    ),
    (
      select ct.currency
      from public.courts as ct
      where ct.club_id = c.id
        and ct.is_active = true
        and ct.currency is not null
      order by ct.price_minor nulls last
      limit 1
    ),
    exists (
      select 1
      from public.player_favorite_clubs as pfc
      where pfc.user_id = v_user_id
        and pfc.club_id = c.id
    )
  from public.clubs as c
  join public.zones as z on z.id = c.zone_id
  where c.is_active = true
    and (
      p_zone_ids is null
      or cardinality(p_zone_ids) = 0
      or c.zone_id = any (p_zone_ids)
    )
  order by
    exists (
      select 1
      from public.player_favorite_clubs as pfc
      where pfc.user_id = v_user_id
        and pfc.club_id = c.id
    ) desc,
    c.name;
end;
$$;

create or replace function public.get_club_detail(p_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id := public.assert_discovery_caller_eligible();

  select jsonb_build_object(
    'club_id', c.id,
    'name', c.name,
    'slug', c.slug,
    'description', c.description,
    'address_public', c.address_public,
    'zone_id', c.zone_id,
    'zone_slug', z.slug,
    'zone_name_i18n', z.name_i18n,
    'latitude', c.latitude,
    'longitude', c.longitude,
    'booking_mode', c.booking_mode,
    'amenities', c.amenities,
    'is_favorite', exists (
      select 1
      from public.player_favorite_clubs as pfc
      where pfc.user_id = v_user_id
        and pfc.club_id = c.id
    ),
    'courts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'court_id', ct.id,
            'name', ct.name,
            'surface', ct.surface,
            'is_indoor', ct.is_indoor,
            'price_minor', ct.price_minor,
            'currency', ct.currency,
            'slot_minutes', ct.slot_minutes
          )
          order by ct.name
        )
        from public.courts as ct
        where ct.club_id = c.id
          and ct.is_active = true
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.clubs as c
  join public.zones as z on z.id = c.zone_id
  where c.id = p_club_id
    and c.is_active = true;

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  return v_result;
end;
$$;

create or replace function public.set_club_favorite(
  p_club_id uuid,
  p_favorite boolean
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
    select 1 from public.clubs as c where c.id = p_club_id and c.is_active = true
  ) then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if p_favorite then
    insert into public.player_favorite_clubs (user_id, club_id)
    values (v_user_id, p_club_id)
    on conflict do nothing;
  else
    delete from public.player_favorite_clubs
    where user_id = v_user_id
      and club_id = p_club_id;
  end if;
end;
$$;

create or replace function public.request_match_booking(
  p_match_id uuid,
  p_court_id uuid
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
  v_court public.courts%rowtype;
  v_club public.clubs%rowtype;
  v_time public.match_time_options%rowtype;
  v_booking_id uuid;
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
    raise exception using errcode = '42501', message = 'Only the match creator can request a court';
  end if;

  if v_match.status <> 'ready_to_book' then
    raise exception using errcode = 'P0001', message = 'Match is not ready to book';
  end if;

  if v_match.selected_time_option_id is null then
    raise exception using errcode = 'P0001', message = 'No agreed time selected';
  end if;

  select *
  into v_time
  from public.match_time_options as mto
  where mto.id = v_match.selected_time_option_id
    and mto.match_id = p_match_id
    and mto.withdrawn_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'Agreed time is not available';
  end if;

  if exists (
    select 1
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status in ('requested', 'alternative_proposed', 'accepted')
  ) then
    raise exception using errcode = 'P0001', message = 'An active booking already exists for this match';
  end if;

  select *
  into v_court
  from public.courts as ct
  where ct.id = p_court_id
    and ct.is_active = true
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Court not found';
  end if;

  select *
  into v_club
  from public.clubs as c
  where c.id = v_court.club_id
    and c.is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  if v_club.booking_mode <> 'manual_request' then
    raise exception using errcode = 'P0001', message = 'Club does not accept in-app booking requests';
  end if;

  if public.court_has_block(v_court.id, v_time.starts_at, v_time.ends_at) then
    raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
  end if;

  insert into public.bookings (
    match_id,
    court_id,
    requested_by,
    status,
    starts_at,
    ends_at,
    price_minor,
    currency,
    payment_method
  )
  values (
    p_match_id,
    v_court.id,
    v_user_id,
    'requested',
    v_time.starts_at,
    v_time.ends_at,
    v_court.price_minor,
    v_court.currency,
    'pay_at_club'
  )
  returning id into v_booking_id;

  perform public.append_booking_event(
    v_booking_id,
    null,
    'requested',
    v_user_id,
    null,
    jsonb_build_object('court_id', v_court.id, 'club_id', v_club.id)
  );

  update public.matches
  set status = 'booking_pending',
      updated_at = now()
  where id = p_match_id;

  return v_booking_id;
end;
$$;

create or replace function public.cancel_booking_request(p_booking_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_booking public.bookings%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_booking
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if v_booking.requested_by <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the requester can cancel this booking';
  end if;

  if v_booking.status <> 'requested' then
    raise exception using errcode = 'P0001', message = 'Only requested bookings can be cancelled';
  end if;

  update public.bookings
  set status = 'cancelled',
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now()
  where id = p_booking_id;

  perform public.append_booking_event(
    p_booking_id,
    'requested',
    'cancelled',
    v_user_id
  );

  update public.matches
  set status = 'ready_to_book',
      updated_at = now()
  where id = v_booking.match_id
    and status = 'booking_pending';
end;
$$;

create or replace function public.accept_booking(p_booking_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_booking public.bookings%rowtype;
  v_club_id uuid;
begin
  select *
  into v_booking
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  select ct.club_id into v_club_id from public.courts as ct where ct.id = v_booking.court_id;
  v_user_id := public.assert_club_staff(v_club_id);

  if v_booking.status <> 'requested' then
    raise exception using errcode = 'P0001', message = 'Only requested bookings can be accepted';
  end if;

  if public.court_has_block(v_booking.court_id, v_booking.starts_at, v_booking.ends_at) then
    raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
  end if;

  update public.bookings
  set status = 'accepted',
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now(),
      proposed_court_id = null,
      proposed_start_at = null,
      proposed_end_at = null
  where id = p_booking_id;

  perform public.append_booking_event(
    p_booking_id,
    'requested',
    'accepted',
    v_user_id
  );

  update public.matches
  set status = 'confirmed',
      updated_at = now()
  where id = v_booking.match_id;
end;
$$;

create or replace function public.reject_booking(
  p_booking_id uuid,
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
  v_booking public.bookings%rowtype;
  v_club_id uuid;
begin
  select *
  into v_booking
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  select ct.club_id into v_club_id from public.courts as ct where ct.id = v_booking.court_id;
  v_user_id := public.assert_club_staff(v_club_id);

  if v_booking.status <> 'requested' then
    raise exception using errcode = 'P0001', message = 'Only requested bookings can be rejected';
  end if;

  update public.bookings
  set status = 'rejected',
      club_note = nullif(trim(coalesce(p_reason, '')), ''),
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now()
  where id = p_booking_id;

  perform public.append_booking_event(
    p_booking_id,
    'requested',
    'rejected',
    v_user_id,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  update public.matches
  set status = 'ready_to_book',
      updated_at = now()
  where id = v_booking.match_id
    and status = 'booking_pending';
end;
$$;

create or replace function public.propose_booking_alternative(
  p_booking_id uuid,
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
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
  v_booking public.bookings%rowtype;
  v_club_id uuid;
  v_court public.courts%rowtype;
begin
  select *
  into v_booking
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  select ct.club_id into v_club_id from public.courts as ct where ct.id = v_booking.court_id;
  v_user_id := public.assert_club_staff(v_club_id);

  if v_booking.status <> 'requested' then
    raise exception using errcode = 'P0001', message = 'Only requested bookings can receive an alternative';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception using errcode = 'P0001', message = 'Invalid alternative time range';
  end if;

  select *
  into v_court
  from public.courts as ct
  where ct.id = p_court_id
    and ct.is_active = true;

  if not found or v_court.club_id <> v_club_id then
    raise exception using errcode = 'P0001', message = 'Alternative court must belong to the same club';
  end if;

  if public.court_has_block(v_court.id, p_starts_at, p_ends_at) then
    raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
  end if;

  update public.bookings
  set status = 'alternative_proposed',
      proposed_court_id = v_court.id,
      proposed_start_at = p_starts_at,
      proposed_end_at = p_ends_at,
      club_note = nullif(trim(coalesce(p_reason, '')), ''),
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now()
  where id = p_booking_id;

  perform public.append_booking_event(
    p_booking_id,
    'requested',
    'alternative_proposed',
    v_user_id,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'proposed_court_id', v_court.id,
      'proposed_start_at', p_starts_at,
      'proposed_end_at', p_ends_at
    )
  );
end;
$$;

create or replace function public.respond_booking_alternative(
  p_booking_id uuid,
  p_accept boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_booking public.bookings%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_booking
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if v_booking.requested_by <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the requester can respond to an alternative';
  end if;

  if v_booking.status <> 'alternative_proposed' then
    raise exception using errcode = 'P0001', message = 'No alternative to respond to';
  end if;

  if p_accept then
    if v_booking.proposed_court_id is null
       or v_booking.proposed_start_at is null
       or v_booking.proposed_end_at is null then
      raise exception using errcode = 'P0001', message = 'Alternative details are incomplete';
    end if;

    if public.court_has_block(
      v_booking.proposed_court_id,
      v_booking.proposed_start_at,
      v_booking.proposed_end_at
    ) then
      raise exception using errcode = 'P0001', message = 'Court is blocked for this time';
    end if;

    update public.bookings
    set status = 'accepted',
        court_id = v_booking.proposed_court_id,
        starts_at = v_booking.proposed_start_at,
        ends_at = v_booking.proposed_end_at,
        proposed_court_id = null,
        proposed_start_at = null,
        proposed_end_at = null,
        acted_by = v_user_id,
        acted_at = now(),
        updated_at = now()
    where id = p_booking_id;

    perform public.append_booking_event(
      p_booking_id,
      'alternative_proposed',
      'accepted',
      v_user_id
    );

    update public.matches
    set status = 'confirmed',
        updated_at = now()
    where id = v_booking.match_id;
  else
    update public.bookings
    set status = 'cancelled',
        acted_by = v_user_id,
        acted_at = now(),
        updated_at = now(),
        proposed_court_id = null,
        proposed_start_at = null,
        proposed_end_at = null
    where id = p_booking_id;

    perform public.append_booking_event(
      p_booking_id,
      'alternative_proposed',
      'cancelled',
      v_user_id,
      'Requester declined alternative'
    );

    update public.matches
    set status = 'ready_to_book',
        updated_at = now()
    where id = v_booking.match_id
      and status = 'booking_pending';
  end if;
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

revoke all on function public.is_club_staff(uuid, uuid) from public, anon;
grant execute on function public.is_club_staff(uuid, uuid) to authenticated;

revoke all on function public.assert_club_staff(uuid) from public, anon;
grant execute on function public.assert_club_staff(uuid) to authenticated;

revoke all on function public.list_clubs_directory(uuid[]) from public, anon;
grant execute on function public.list_clubs_directory(uuid[]) to authenticated;

revoke all on function public.get_club_detail(uuid) from public, anon;
grant execute on function public.get_club_detail(uuid) to authenticated;

revoke all on function public.set_club_favorite(uuid, boolean) from public, anon;
grant execute on function public.set_club_favorite(uuid, boolean) to authenticated;

revoke all on function public.request_match_booking(uuid, uuid) from public, anon;
grant execute on function public.request_match_booking(uuid, uuid) to authenticated;

revoke all on function public.cancel_booking_request(uuid) from public, anon;
grant execute on function public.cancel_booking_request(uuid) to authenticated;

revoke all on function public.accept_booking(uuid) from public, anon;
grant execute on function public.accept_booking(uuid) to authenticated;

revoke all on function public.reject_booking(uuid, text) from public, anon;
grant execute on function public.reject_booking(uuid, text) to authenticated;

revoke all on function public.propose_booking_alternative(uuid, uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.propose_booking_alternative(uuid, uuid, timestamptz, timestamptz, text) to authenticated;

revoke all on function public.respond_booking_alternative(uuid, boolean) from public, anon;
grant execute on function public.respond_booking_alternative(uuid, boolean) to authenticated;
