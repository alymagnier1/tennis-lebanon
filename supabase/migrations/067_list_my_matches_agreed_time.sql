-- list_my_matches.soonest_time only returned future proposed slots, so
-- in_progress / pending-submission cards lost their agreed hour after kickoff.
-- Prefer the selected slot (even when past), else the soonest future option.

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
  can_extend_listing boolean,
  has_court boolean,
  court_starts_at timestamptz,
  opponent_names text,
  club_name text,
  preferred_clubs jsonb,
  zones jsonb
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
    coalesce(
      (
        select mto.starts_at
        from public.match_time_options as mto
        where mto.id = m.selected_time_option_id
          and mto.withdrawn_at is null
      ),
      (
        select min(mto.starts_at)
        from public.match_time_options as mto
        where mto.match_id = m.id
          and mto.withdrawn_at is null
          and mto.ends_at > now()
      )
    ),
    m.notes,
    m.updated_at,
    public.match_listing_expires_at(m.created_at, m.listing_extended_at),
    public.match_is_stale_warning(m.id),
    (
      mp.is_creator
      and m.status in ('open', 'full')
      and public.match_is_stale_warning(m.id)
    ),
    (b.id is not null),
    b.starts_at,
    (
      select string_agg(p.display_name, ', ' order by p.display_name)
      from public.match_participants as mp_other
      join public.profiles as p on p.id = mp_other.user_id
      where mp_other.match_id = m.id
        and mp_other.status = 'accepted'
        and mp_other.user_id <> v_user_id
    ),
    c.name,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'club_id', pc.id,
            'name', pc.name,
            'booking_mode', pc.booking_mode
          )
          order by pc.name
        ),
        '[]'::jsonb
      )
      from public.match_preferred_clubs as mpc
      join public.clubs as pc on pc.id = mpc.club_id
      where mpc.match_id = m.id
        and pc.is_active = true
    ),
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', z.id,
            'slug', z.slug,
            'name_i18n', z.name_i18n
          )
        ),
        '[]'::jsonb
      )
      from public.match_zones as mz
      join public.zones as z on z.id = mz.zone_id
      where mz.match_id = m.id
    )
  from public.match_participants as mp
  join public.matches as m on m.id = mp.match_id
  left join public.bookings as b
    on b.match_id = m.id
   and b.status = 'accepted'
  left join public.courts as ct on ct.id = b.court_id
  left join public.clubs as c on c.id = ct.club_id
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

revoke all on function public.list_my_matches() from public, anon;
grant execute on function public.list_my_matches() to authenticated;
