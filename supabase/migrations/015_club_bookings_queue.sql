-- Milestone 5.2: club staff booking queue RPCs for the dashboard.

create or replace function public.list_staff_clubs()
returns table (
  club_id uuid,
  name text,
  slug text,
  role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  return query
  select
    c.id,
    c.name,
    c.slug,
    cm.role::text
  from public.club_memberships as cm
  join public.clubs as c on c.id = cm.club_id
  where cm.user_id = v_user_id
    and cm.is_active = true
    and cm.role in ('staff', 'admin')
    and c.is_active = true
  order by c.name;
end;
$$;

create or replace function public.list_club_booking_requests(
  p_club_id uuid,
  p_statuses public.booking_status[] default array['requested']::public.booking_status[],
  p_search text default null
)
returns table (
  booking_id uuid,
  match_id uuid,
  status public.booking_status,
  court_id uuid,
  court_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  requested_by uuid,
  requester_name text,
  match_format public.match_format,
  participant_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text;
begin
  perform public.assert_club_staff(p_club_id);
  v_search := nullif(trim(coalesce(p_search, '')), '');

  return query
  select
    b.id,
    b.match_id,
    b.status,
    ct.id,
    ct.name,
    b.starts_at,
    b.ends_at,
    b.requested_by,
    p.display_name,
    m.format,
    (
      select count(*)::integer
      from public.match_participants as mp
      where mp.match_id = m.id
        and mp.status = 'accepted'
    ),
    b.created_at
  from public.bookings as b
  join public.courts as ct on ct.id = b.court_id
  join public.matches as m on m.id = b.match_id
  join public.profiles as p on p.id = b.requested_by
  where ct.club_id = p_club_id
    and (p_statuses is null or b.status = any(p_statuses))
    and (
      v_search is null
      or p.display_name ilike '%' || v_search || '%'
      or ct.name ilike '%' || v_search || '%'
    )
  order by
    case b.status
      when 'requested' then 0
      when 'alternative_proposed' then 1
      else 2
    end,
    b.created_at asc;
end;
$$;

create or replace function public.get_club_booking_detail(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_club_id uuid;
  v_court public.courts%rowtype;
  v_match public.matches%rowtype;
  v_requester_name text;
  v_proposed_court_name text;
begin
  select *
  into v_booking
  from public.bookings as b
  where b.id = p_booking_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  select *
  into v_court
  from public.courts as ct
  where ct.id = v_booking.court_id;

  v_club_id := v_court.club_id;
  perform public.assert_club_staff(v_club_id);

  select *
  into v_match
  from public.matches as m
  where m.id = v_booking.match_id;

  select p.display_name
  into v_requester_name
  from public.profiles as p
  where p.id = v_booking.requested_by;

  if v_booking.proposed_court_id is not null then
    select ct.name
    into v_proposed_court_name
    from public.courts as ct
    where ct.id = v_booking.proposed_court_id;
  end if;

  return jsonb_build_object(
    'booking', jsonb_build_object(
      'booking_id', v_booking.id,
      'status', v_booking.status,
      'court_id', v_booking.court_id,
      'court_name', v_court.name,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'price_minor', v_booking.price_minor,
      'currency', v_booking.currency,
      'payment_method', v_booking.payment_method,
      'club_note', v_booking.club_note,
      'proposed_court_id', v_booking.proposed_court_id,
      'proposed_court_name', v_proposed_court_name,
      'proposed_start_at', v_booking.proposed_start_at,
      'proposed_end_at', v_booking.proposed_end_at,
      'created_at', v_booking.created_at,
      'acted_at', v_booking.acted_at
    ),
    'match', jsonb_build_object(
      'match_id', v_match.id,
      'format', v_match.format,
      'status', v_match.status,
      'play_intent', v_match.intent
    ),
    'requester', jsonb_build_object(
      'user_id', v_booking.requested_by,
      'display_name', v_requester_name
    ),
    'club', jsonb_build_object(
      'club_id', v_club_id,
      'name', (select c.name from public.clubs as c where c.id = v_club_id)
    ),
    'participants', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', mp.user_id,
            'display_name', p.display_name,
            'is_creator', mp.is_creator
          )
          order by mp.is_creator desc, p.display_name
        )
        from public.match_participants as mp
        join public.profiles as p on p.id = mp.user_id
        where mp.match_id = v_match.id
          and mp.status = 'accepted'
      ),
      '[]'::jsonb
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
        where ct.club_id = v_club_id
          and ct.is_active = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.list_staff_clubs() from public, anon;
grant execute on function public.list_staff_clubs() to authenticated;

revoke all on function public.list_club_booking_requests(uuid, public.booking_status[], text) from public, anon;
grant execute on function public.list_club_booking_requests(uuid, public.booking_status[], text) to authenticated;

revoke all on function public.get_club_booking_detail(uuid) from public, anon;
grant execute on function public.get_club_booking_detail(uuid) to authenticated;
