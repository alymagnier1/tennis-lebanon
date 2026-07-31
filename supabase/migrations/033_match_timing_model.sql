-- Milestone 8.10: time becomes a property of the match.
--
-- Audit finding BL-01: reaching ready_to_book required every accepted
-- participant to vote yes on the same option, while only the creator could add
-- or withdraw options (capped at three). One unresponsive host, or one player
-- whose availability matched none of the three slots, left the match to die
-- quietly at `full`. No RPC could set an agreed time directly, so there was no
-- way out. That is the ghosting path.
--
-- Fixed mode makes the host name a time up front and treats joining as consent
-- to it. Flexible mode keeps the old unanimous vote for groups that want it.
-- Chat is available from the moment someone joins, so renegotiation happens
-- there and is committed through reschedule_match_time.

alter table public.matches
  add column if not exists timing_mode text not null default 'flexible';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_timing_mode_check'
  ) then
    alter table public.matches
      add constraint matches_timing_mode_check
      check (timing_mode in ('fixed', 'flexible'));
  end if;
end;
$$;

-- Existing rows keep the voting semantics they were created under; everything
-- new defaults to a fixed time.
alter table public.matches alter column timing_mode set default 'fixed';

-- ---------------------------------------------------------------------------
-- State refresh
-- ---------------------------------------------------------------------------

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

  -- A fixed match already has its time; there is nothing to agree.
  if v_match.timing_mode = 'fixed' then
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

  if v_match.timing_mode = 'fixed' then
    -- Joining is consent, so a full roster is immediately bookable. The agreed
    -- time is a property of the match and survives someone leaving.
    if v_count >= v_capacity and v_match.selected_time_option_id is not null then
      update public.matches
      set status = 'ready_to_book', updated_at = now()
      where id = p_match_id
        and status in ('open', 'full');
    elsif v_count >= v_capacity then
      update public.matches
      set status = 'full', updated_at = now()
      where id = p_match_id
        and status = 'open';
    else
      update public.matches
      set status = 'open', updated_at = now()
      where id = p_match_id
        and status in ('full', 'ready_to_book');
    end if;

    return;
  end if;

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

-- ---------------------------------------------------------------------------
-- Voting is meaningless in fixed mode
-- ---------------------------------------------------------------------------

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

  if v_match.timing_mode = 'fixed' then
    raise exception using errcode = 'P0001', message = 'match_uses_fixed_time';
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

  insert into public.match_time_votes (time_option_id, user_id, vote)
  values (p_time_option_id, v_user_id, p_vote)
  on conflict (time_option_id, user_id)
  do update set vote = excluded.vote, updated_at = now();

  perform public.refresh_match_time_agreement(p_match_id);
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

  if v_match.timing_mode = 'fixed' then
    raise exception using errcode = 'P0001', message = 'match_uses_fixed_time';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at <= now() then
    raise exception using errcode = '22023', message = 'Invalid proposed time';
  end if;

  if public.match_active_time_option_count(p_match_id) >= 3 then
    raise exception using errcode = 'P0001', message = 'time_option_limit_reached';
  end if;

  insert into public.match_time_options (match_id, starts_at, ends_at, proposed_by)
  values (p_match_id, p_starts_at, p_ends_at, v_user_id)
  returning id into v_option_id;

  perform public.refresh_match_time_agreement(p_match_id);
  return v_option_id;
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
  v_timing_mode text;
begin
  v_user_id := public.assert_marketplace_caller();

  select mto.match_id, m.timing_mode
  into v_match_id, v_timing_mode
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

  if v_timing_mode = 'fixed' then
    raise exception using errcode = 'P0001', message = 'match_uses_fixed_time';
  end if;

  update public.match_time_options
  set withdrawn_at = now()
  where id = p_time_option_id;

  perform public.refresh_match_time_agreement(v_match_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- The hub must expose the timing mode so the client knows whether to offer
-- voting or a reschedule, and must stop telling fixed-match participants to
-- vote on times that are not up for a vote.
-- ---------------------------------------------------------------------------

alter type public.match_hub_card
  add attribute timing_mode text;

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
  v_card.timing_mode := v_match.timing_mode;
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
    -- Nothing is up for a vote on a fixed match; the roster is what is missing.
    v_card.next_action := case
      when v_match.timing_mode = 'fixed' then 'awaiting_players'
      else 'vote_on_times'
    end;
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

-- ---------------------------------------------------------------------------
-- A full fixed match sits at ready_to_book, so joinability must report the
-- accurate reason. Without this, a would-be joiner gets the generic
-- match_not_joinable where they used to get match_full.
-- ---------------------------------------------------------------------------

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

  -- ready_to_book always implies a full roster: a fixed match drops back to
  -- open the moment someone leaves.
  if v_match.status = 'ready_to_book' then
    raise exception using errcode = 'P0001', message = 'match_full';
  end if;

  if v_match.status not in ('open', 'full') then
    raise exception using errcode = 'P0001', message = 'match_not_joinable';
  end if;

  if not p_allow_non_public and v_match.visibility <> 'public' then
    raise exception using errcode = '42501', message = 'Match is not publicly joinable';
  end if;

  if public.is_blocked_from_match(p_viewer_id, p_match_id) then
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

-- ---------------------------------------------------------------------------
-- Join requests must still be answerable once the roster is full
--
-- A fixed match jumps from `full` straight to `ready_to_book`, but the old
-- implementation ran assert_joinable_match first, which only allows
-- open/full. That left any outstanding request un-declinable and orphaned.
-- Checking the match directly also drops assert_joinable_match's skill-band
-- test, which compared the *creator's* band and could lock a host out of
-- their own approvals.
-- ---------------------------------------------------------------------------

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
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
begin
  v_creator_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if v_match.creator_id <> v_creator_id then
    raise exception using errcode = '42501', message = 'Only the creator can respond to join requests';
  end if;

  if v_match.status not in ('open', 'full', 'ready_to_book') then
    raise exception using errcode = 'P0001', message = 'match_not_joinable';
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
    v_capacity := public.match_capacity_for_format(v_match.format);
    v_count := public.match_participant_count(p_match_id);

    if v_count >= v_capacity then
      raise exception using errcode = 'P0001', message = 'match_full';
    end if;

    if public.is_blocked_from_match(p_user_id, p_match_id) then
      raise exception using errcode = '42501', message = 'Blocked relationship';
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

-- ---------------------------------------------------------------------------
-- Host reschedule: chat is where renegotiation happens, this commits it
-- ---------------------------------------------------------------------------

create or replace function public.reschedule_match_time(
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
  v_participant record;
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
    raise exception using errcode = '42501', message = 'Only the creator can change the time';
  end if;

  if v_match.timing_mode <> 'fixed' then
    raise exception using errcode = 'P0001', message = 'match_uses_time_voting';
  end if;

  -- Once a court has been requested the hour is committed at the club; the
  -- booking must be withdrawn before the match can move.
  if v_match.status not in ('draft', 'open', 'full', 'ready_to_book') then
    raise exception using errcode = 'P0001', message = 'match_time_locked_by_booking';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at <= now() then
    raise exception using errcode = '22023', message = 'Invalid proposed time';
  end if;

  update public.match_time_options
  set withdrawn_at = now()
  where match_id = p_match_id
    and withdrawn_at is null;

  insert into public.match_time_options (match_id, starts_at, ends_at, proposed_by)
  values (p_match_id, p_starts_at, p_ends_at, v_user_id)
  returning id into v_option_id;

  update public.matches
  set selected_time_option_id = v_option_id, updated_at = now()
  where id = p_match_id;

  perform public.refresh_match_open_state(p_match_id);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'match_time_rescheduled',
    'match',
    p_match_id,
    jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at)
  );

  -- Everyone who already committed to the old time needs to know.
  for v_participant in
    select mp.user_id
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'accepted'
      and mp.user_id <> v_user_id
  loop
    perform public.enqueue_notification(
      v_participant.user_id,
      'match_time_changed',
      'match',
      p_match_id,
      format('match_time_changed:%s:%s:%s', p_match_id, v_participant.user_id, v_option_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', p_match_id),
        'title', 'Match time changed',
        'body', 'The host moved this match. Open the app to see the new time.'
      ),
      now()
    );
  end loop;

  return v_option_id;
end;
$$;

revoke all on function public.reschedule_match_time(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.reschedule_match_time(uuid, timestamptz, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Availability-driven time suggestions
--
-- The app already stores structured availability and computes overlap, so a
-- host should not have to guess. Ranks candidate slots by how many compatible
-- players are free for the whole slot.
-- ---------------------------------------------------------------------------

create or replace function public.suggest_match_times(
  p_zone_ids uuid[] default null,
  p_format public.match_format default null,
  p_min_skill public.skill_band default null,
  p_max_skill public.skill_band default null,
  p_horizon_days integer default 14,
  p_slot_minutes integer default 90,
  p_limit integer default 3
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  candidate_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid;
  v_viewer_band public.skill_band;
  v_zone_ids uuid[];
  v_range_start timestamptz := now();
  v_range_end timestamptz;
  v_slot interval;
  v_limit integer;
  v_min_rank integer;
  v_max_rank integer;
begin
  v_viewer_id := public.assert_marketplace_caller();

  v_limit := least(greatest(coalesce(p_limit, 3), 1), 10);
  v_slot := make_interval(mins => least(greatest(coalesce(p_slot_minutes, 90), 30), 240));
  v_range_end := v_range_start + make_interval(
    days => least(greatest(coalesce(p_horizon_days, 14), 1), 28)
  );

  select pp.skill_band
  into v_viewer_band
  from public.player_profiles as pp
  where pp.user_id = v_viewer_id;

  -- Default to the viewer's band plus or minus one, matching discovery's
  -- DEFAULT_LEVEL_WINDOW. Defaulting to the exact band would exclude adjacent
  -- levels and make suggestions almost always empty at pilot scale.
  if p_min_skill is null then
    v_min_rank := greatest(public.skill_band_rank(v_viewer_band) - 1, 1);
  else
    v_min_rank := public.skill_band_rank(p_min_skill);
  end if;

  if p_max_skill is null then
    v_max_rank := least(public.skill_band_rank(v_viewer_band) + 1, 5);
  else
    v_max_rank := public.skill_band_rank(p_max_skill);
  end if;

  if v_min_rank > v_max_rank then
    raise exception using errcode = '22023', message = 'Invalid skill range';
  end if;

  if p_zone_ids is null or cardinality(p_zone_ids) = 0 then
    select coalesce(array_agg(pz.zone_id), '{}'::uuid[])
    into v_zone_ids
    from public.player_zones as pz
    where pz.user_id = v_viewer_id;
  else
    v_zone_ids := p_zone_ids;
  end if;

  return query
  with viewer_intervals as (
    select a.starts_at, a.ends_at
    from public.expand_user_availability(v_viewer_id, v_range_start, v_range_end) as a
  ),
  viewer_slots as (
    select
      slot_start as slot_starts_at,
      slot_start + v_slot as slot_ends_at
    from viewer_intervals as vi
    cross join lateral generate_series(
      vi.starts_at,
      vi.ends_at - v_slot,
      interval '1 hour'
    ) as slot_start
    where slot_start >= v_range_start
  ),
  eligible as (
    select p.id as user_id
    from public.profiles as p
    join public.player_profiles as pp on pp.user_id = p.id
    where p.id <> v_viewer_id
      and p.account_status = 'active'
      and p.onboarding_completed_at is not null
      and p.is_adult_confirmed = true
      and not public.is_blocked(v_viewer_id, p.id)
      and public.skill_band_rank(pp.skill_band) between v_min_rank and v_max_rank
      and (
        p_format is null
        or (p_format = 'singles' and pp.prefers_singles)
        or (p_format = 'doubles' and pp.prefers_doubles)
      )
      and (
        cardinality(v_zone_ids) = 0
        or exists (
          select 1
          from public.player_zones as pz
          where pz.user_id = p.id
            and pz.zone_id = any(v_zone_ids)
        )
      )
  ),
  eligible_availability as (
    select e.user_id, a.starts_at, a.ends_at
    from eligible as e
    cross join lateral public.expand_user_availability(
      e.user_id, v_range_start, v_range_end
    ) as a
  )
  select
    vs.slot_starts_at,
    vs.slot_ends_at,
    count(distinct ea.user_id)::integer
  from viewer_slots as vs
  left join eligible_availability as ea
    on ea.starts_at <= vs.slot_starts_at
   and ea.ends_at >= vs.slot_ends_at
  group by vs.slot_starts_at, vs.slot_ends_at
  order by count(distinct ea.user_id) desc, vs.slot_starts_at asc
  limit v_limit;
end;
$$;

revoke all on function public.suggest_match_times(
  uuid[], public.match_format, public.skill_band, public.skill_band, integer, integer, integer
) from public, anon;
grant execute on function public.suggest_match_times(
  uuid[], public.match_format, public.skill_band, public.skill_band, integer, integer, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Creation: fixed mode takes exactly one time and locks it in at publish.
--
-- Adding a parameter creates an overload rather than replacing the function,
-- so the previous signatures are dropped first.
-- ---------------------------------------------------------------------------

drop function if exists public.create_and_publish_match(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb
);

drop function if exists public.create_match_draft(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb
);

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
  p_timing_mode text default 'fixed'
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
begin
  v_user_id := public.assert_marketplace_caller();
  v_timing_mode := coalesce(nullif(trim(p_timing_mode), ''), 'fixed');

  if v_timing_mode not in ('fixed', 'flexible') then
    raise exception using errcode = '22023', message = 'Unsupported timing mode';
  end if;

  if exists (
    select 1
    from public.matches as m
    where m.creator_id = v_user_id
      and m.format = p_format
      and m.status in ('draft', 'open', 'full', 'ready_to_book')
  ) then
    raise exception using errcode = 'P0001', message = 'active_hosted_match_exists';
  end if;

  if public.skill_band_rank(p_min_skill) > public.skill_band_rank(p_max_skill) then
    raise exception using errcode = '22023', message = 'Invalid skill range';
  end if;

  if p_zone_ids is null or cardinality(p_zone_ids) = 0 then
    raise exception using errcode = '22023', message = 'At least one zone is required';
  end if;

  perform public.assert_active_zones(p_zone_ids);

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

  if exists (
    select 1
    from public.matches as m
    where m.creator_id = v_user_id
      and m.format = v_match.format
      and m.id <> p_match_id
      and m.status in ('open', 'full', 'ready_to_book')
  ) then
    raise exception using errcode = 'P0001', message = 'active_hosted_match_exists';
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

create or replace function public.create_and_publish_match(
  p_format public.match_format,
  p_visibility public.match_visibility,
  p_intent public.play_intent,
  p_min_skill public.skill_band,
  p_max_skill public.skill_band,
  p_requires_creator_approval boolean,
  p_notes text default null,
  p_zone_ids uuid[] default '{}'::uuid[],
  p_proposed_times jsonb default '[]'::jsonb,
  p_timing_mode text default 'fixed'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_match_id uuid;
begin
  v_match_id := public.create_match_draft(
    p_format,
    p_visibility,
    p_intent,
    p_min_skill,
    p_max_skill,
    p_requires_creator_approval,
    p_notes,
    p_zone_ids,
    p_proposed_times,
    p_timing_mode
  );

  perform public.publish_match(v_match_id);
  return v_match_id;
end;
$$;

revoke all on function public.create_match_draft(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text
) from public, anon;
grant execute on function public.create_match_draft(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text
) to authenticated;

revoke all on function public.create_and_publish_match(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text
) from public, anon;
grant execute on function public.create_and_publish_match(
  public.match_format, public.match_visibility, public.play_intent,
  public.skill_band, public.skill_band, boolean, text, uuid[], jsonb, text
) to authenticated;
