-- Milestone 7.1: attendance, result submission/confirmation, and idempotent rating.

alter type public.match_hub_card
  add attribute result jsonb,
  add attribute viewer_attendance public.attendance_status;

create or replace function public.assert_accepted_match_participant(
  p_match_id uuid,
  p_user_id uuid default auth.uid()
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = p_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only accepted participants can perform this action';
  end if;
end;
$$;

create or replace function public.record_match_attendance(
  p_match_id uuid,
  p_attendance public.attendance_status
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_status public.match_status;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select m.status
  into v_status
  from public.matches as m
  where m.id = p_match_id;

  if v_status not in ('in_progress', 'completed') then
    raise exception using errcode = 'P0001', message = 'Attendance can only be recorded after the match starts';
  end if;

  if p_attendance not in ('attended', 'no_show', 'late_cancel', 'cancelled_in_time') then
    raise exception using errcode = 'P0001', message = 'Invalid attendance status';
  end if;

  update public.match_participants as mp
  set attendance = p_attendance
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id;
end;
$$;

create or replace function public.submit_match_result(
  p_match_id uuid,
  p_score jsonb,
  p_winner_user_id uuid
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
  v_sets jsonb;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if v_match.status <> 'in_progress' then
    raise exception using errcode = 'P0001', message = 'Result can only be submitted while the match is in progress';
  end if;

  if exists (
    select 1
    from public.match_results as mr
    where mr.match_id = p_match_id
  ) then
    raise exception using errcode = 'P0001', message = 'A result already exists for this match';
  end if;

  if p_winner_user_id is null then
    raise exception using errcode = 'P0001', message = 'Winner is required';
  end if;

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = p_winner_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = 'P0001', message = 'Winner must be an accepted participant';
  end if;

  v_sets := p_score->'sets';
  if v_sets is null
     or jsonb_typeof(v_sets) <> 'array'
     or jsonb_array_length(v_sets) < 1 then
    raise exception using errcode = 'P0001', message = 'Score must include at least one set';
  end if;

  insert into public.match_results (
    match_id,
    submitted_by,
    status,
    score,
    winner_user_id
  )
  values (
    p_match_id,
    v_user_id,
    'submitted',
    p_score,
    p_winner_user_id
  )
  returning id into v_result_id;

  return v_result_id;
end;
$$;

create or replace function public.apply_rating_for_result(p_result_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result public.match_results%rowtype;
  v_match public.matches%rowtype;
  v_loser_id uuid;
  v_winner_rating integer;
  v_loser_rating integer;
  v_k constant integer := 32;
  v_expected_winner numeric;
  v_expected_loser numeric;
  v_new_winner integer;
  v_new_loser integer;
begin
  select *
  into v_result
  from public.match_results as mr
  where mr.id = p_result_id
  for update;

  if not found or v_result.status <> 'confirmed' then
    return;
  end if;

  if exists (
    select 1
    from public.rating_events as re
    where re.result_id = p_result_id
  ) then
    return;
  end if;

  select *
  into v_match
  from public.matches as m
  where m.id = v_result.match_id;

  if v_match.format <> 'singles' then
    return;
  end if;

  select mp.user_id
  into v_loser_id
  from public.match_participants as mp
  where mp.match_id = v_result.match_id
    and mp.status = 'accepted'
    and mp.user_id <> v_result.winner_user_id
  limit 1;

  if v_loser_id is null then
    return;
  end if;

  select pp.internal_rating
  into v_winner_rating
  from public.player_profiles as pp
  where pp.user_id = v_result.winner_user_id
  for update;

  select pp.internal_rating
  into v_loser_rating
  from public.player_profiles as pp
  where pp.user_id = v_loser_id
  for update;

  v_expected_winner := 1.0 / (1.0 + power(10::numeric, (v_loser_rating - v_winner_rating) / 400.0));
  v_expected_loser := 1.0 - v_expected_winner;
  v_new_winner := greatest(100, least(3000, round(v_winner_rating + v_k * (1.0 - v_expected_winner))));
  v_new_loser := greatest(100, least(3000, round(v_loser_rating + v_k * (0.0 - v_expected_loser))));

  insert into public.rating_events (
    result_id,
    user_id,
    rating_before,
    rating_after,
    algorithm_version
  )
  values
    (p_result_id, v_result.winner_user_id, v_winner_rating, v_new_winner, 'elo-v1'),
    (p_result_id, v_loser_id, v_loser_rating, v_new_loser, 'elo-v1');

  update public.player_profiles as pp
  set
    internal_rating = v_new_winner,
    rated_match_count = pp.rated_match_count + 1
  where pp.user_id = v_result.winner_user_id;

  update public.player_profiles as pp
  set
    internal_rating = v_new_loser,
    rated_match_count = pp.rated_match_count + 1
  where pp.user_id = v_loser_id;
end;
$$;

create or replace function public.confirm_match_result(p_match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_result public.match_results%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select *
  into v_result
  from public.match_results as mr
  where mr.match_id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Result not found';
  end if;

  if v_result.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'Result is not awaiting confirmation';
  end if;

  if v_result.submitted_by = v_user_id then
    raise exception using errcode = '42501', message = 'Submitter cannot confirm their own result';
  end if;

  update public.match_results as mr
  set
    status = 'confirmed',
    confirmed_by = v_user_id,
    confirmed_at = now(),
    updated_at = now()
  where mr.id = v_result.id;

  update public.matches as m
  set
    status = 'completed',
    updated_at = now()
  where m.id = p_match_id;

  perform public.apply_rating_for_result(v_result.id);
end;
$$;

create or replace function public.dispute_match_result(
  p_match_id uuid,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_result public.match_results%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();
  perform public.assert_accepted_match_participant(p_match_id, v_user_id);

  select *
  into v_result
  from public.match_results as mr
  where mr.match_id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Result not found';
  end if;

  if v_result.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'Result is not awaiting confirmation';
  end if;

  if v_result.submitted_by = v_user_id then
    raise exception using errcode = '42501', message = 'Submitter cannot dispute their own result';
  end if;

  update public.match_results as mr
  set
    status = 'disputed',
    dispute_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where mr.id = v_result.id;

  update public.matches as m
  set
    status = 'completed',
    updated_at = now()
  where m.id = p_match_id;
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
  v_result jsonb;
  v_viewer_attendance public.attendance_status;
  v_result_row public.match_results%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  select mp.status, mp.is_creator, mp.attendance
  into v_participant_status, v_is_creator, v_viewer_attendance
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

  select *
  into v_result_row
  from public.match_results as mr
  where mr.match_id = p_match_id;

  if found then
    v_result := jsonb_build_object(
      'result_id', v_result_row.id,
      'status', v_result_row.status,
      'submitted_by', v_result_row.submitted_by,
      'score', v_result_row.score,
      'winner_user_id', v_result_row.winner_user_id,
      'confirmed_by', v_result_row.confirmed_by,
      'dispute_note', v_result_row.dispute_note
    );
  end if;

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
  v_card.result := v_result;
  v_card.viewer_attendance := coalesce(v_viewer_attendance, 'unknown'::public.attendance_status);
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
          'is_creator', mp.is_creator,
          'attendance', mp.attendance
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
  elsif v_match.status = 'in_progress'
     and v_participant_status = 'accepted'
     and coalesce(v_viewer_attendance, 'unknown') = 'unknown' then
    v_card.next_action := 'record_attendance';
  elsif v_match.status = 'in_progress'
     and v_participant_status = 'accepted'
     and v_result is null then
    v_card.next_action := 'submit_result';
  elsif v_match.status = 'in_progress'
     and v_participant_status = 'accepted'
     and v_result is not null
     and (v_result->>'status') = 'submitted'
     and (v_result->>'submitted_by')::uuid <> v_user_id then
    v_card.next_action := 'confirm_result';
  elsif v_match.status = 'completed'
     and v_result is not null
     and (v_result->>'status') = 'disputed' then
    v_card.next_action := 'result_disputed';
  elsif v_match.status = 'completed' then
    v_card.next_action := 'view_completed';
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

revoke all on function public.assert_accepted_match_participant(uuid, uuid) from public, anon;
revoke all on function public.record_match_attendance(uuid, public.attendance_status) from public, anon;
revoke all on function public.submit_match_result(uuid, jsonb, uuid) from public, anon;
revoke all on function public.confirm_match_result(uuid) from public, anon;
revoke all on function public.dispute_match_result(uuid, text) from public, anon;
revoke all on function public.apply_rating_for_result(uuid) from public, anon;

grant execute on function public.record_match_attendance(uuid, public.attendance_status) to authenticated;
grant execute on function public.submit_match_result(uuid, jsonb, uuid) to authenticated;
grant execute on function public.confirm_match_result(uuid) to authenticated;
grant execute on function public.dispute_match_result(uuid, text) to authenticated;
grant execute on function public.apply_rating_for_result(uuid) to service_role;
