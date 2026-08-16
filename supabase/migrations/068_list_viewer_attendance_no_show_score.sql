-- Expose the viewer's attendance on Active list rows so "I did not play"
-- can leave Pending without waiting for every participant. The match still
-- expires in the DB only when nobody attended (apply_attendance_completion).

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
  viewer_attendance public.attendance_status,
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
    mp.attendance,
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

-- Nobody who said they did not play may submit a score for that match.
create or replace function public.submit_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_side_a_user_ids uuid[]
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
  v_result_id uuid;
  v_side_a uuid[];
  v_side_b uuid[];
  v_winning_side smallint;
  v_winner_ids uuid[];
  v_attendance public.attendance_status;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.status not in ('in_progress', 'completed') then
    raise exception using errcode = 'P0001', message = 'result_match_not_playable';
  end if;

  select mp.attendance
  into v_attendance
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id;

  if v_attendance in ('no_show', 'late_cancel', 'cancelled_in_time') then
    raise exception using errcode = 'P0001', message = 'result_submitter_did_not_play';
  end if;

  if not public.match_result_entry_open(p_match_id) then
    raise exception using errcode = 'P0001', message = 'result_entry_closed';
  end if;

  if exists (
    select 1
    from public.match_results as mr
    where mr.match_id = p_match_id
  ) then
    raise exception using errcode = 'P0001', message = 'A result already exists for this match';
  end if;

  v_side_a := (
    select coalesce(array_agg(distinct s), '{}'::uuid[])
    from unnest(coalesce(p_side_a_user_ids, '{}'::uuid[])) as s
  );
  perform public.assert_valid_result_sides(p_match_id, v_side_a, v_match.format);
  v_side_b := public.match_side_b_user_ids(p_match_id, v_side_a);

  v_winning_side := public.derive_score_winner_side(p_score);
  v_winner_ids := case when v_winning_side = 1 then v_side_a else v_side_b end;

  insert into public.match_results (
    match_id,
    submitted_by,
    status,
    score,
    side_a_user_ids,
    winning_side,
    winner_user_id,
    revision
  )
  values (
    p_match_id,
    v_user_id,
    'submitted',
    p_score,
    v_side_a,
    v_winning_side,
    v_winner_ids[1],
    1
  )
  returning id into v_result_id;

  -- The gap this milestone exists to close: until now nothing told the other
  -- side a score was waiting on them.
  perform public.notify_match_participants(
    p_match_id,
    'result_confirm_request',
    v_user_id,
    format('%s:1', v_result_id)
  );

  return v_result_id;
end;
$$;

revoke all on function public.submit_match_result(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.submit_match_result(uuid, jsonb, uuid[]) to authenticated;
