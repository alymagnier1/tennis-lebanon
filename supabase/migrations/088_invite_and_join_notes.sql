-- Optional one-way notes on invites and approval-gated join requests.
-- Warmth without a DM channel: note attaches to an action, not a person.

alter table public.match_invitations
  add column note text
  constraint match_invitations_note_length check (
    note is null or char_length(note) <= 140
  );

alter table public.match_participants
  add column join_note text
  constraint match_participants_join_note_length check (
    join_note is null or char_length(join_note) <= 140
  );

-- Trim, null-if-empty, strip URL-shaped tokens. Authoritative; the mobile
-- composer mirrors this for UX only.
create or replace function public.sanitize_player_note(p_note text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_clean text;
begin
  if p_note is null then
    return null;
  end if;

  v_clean := regexp_replace(p_note, '(https?://|www\.)\S+', '', 'gi');
  v_clean := regexp_replace(v_clean, '\s+', ' ', 'g');
  v_clean := trim(v_clean);

  if v_clean = '' then
    return null;
  end if;

  if char_length(v_clean) > 140 then
    raise exception using
      errcode = 'P0001',
      message = 'note_too_long';
  end if;

  return v_clean;
end;
$$;

revoke all on function public.sanitize_player_note(text) from public, anon;
grant execute on function public.sanitize_player_note(text) to authenticated;

-- Adding a defaulted third arg without dropping the two-arg form creates an
-- overload that makes existing two-arg calls ambiguous (same trap as
-- submit_match_result in 064).
drop function if exists public.create_match_invite(uuid, uuid);

create or replace function public.create_match_invite(
  p_match_id uuid,
  p_invited_user_id uuid default null,
  p_note text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_token text;
  v_token_hash text;
  v_invitation_id uuid;
  v_note text;
  v_inviter_name text;
begin
  v_user_id := public.assert_marketplace_caller();

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only participants can invite';
  end if;

  if p_invited_user_id is not null
     and public.is_blocked(v_user_id, p_invited_user_id) then
    raise exception using errcode = '42501', message = 'Blocked relationship';
  end if;

  -- After authorization, so someone with no business here is turned away for
  -- that reason rather than being told about the quota.
  perform public.enforce_invite_rate_limit(v_user_id);

  -- Share-link invites have no recipient; a note would hang on a link with no
  -- one to show it to, so only targeted invites keep it.
  if p_invited_user_id is not null then
    v_note := public.sanitize_player_note(p_note);
  else
    v_note := null;
  end if;

  if p_invited_user_id is not null then
    update public.match_invitations as mi
    set revoked_at = now()
    where mi.match_id = p_match_id
      and mi.invited_user_id = p_invited_user_id
      and mi.revoked_at is null
      and mi.accepted_at is null;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := public.hash_invite_token(v_token);

  insert into public.match_invitations (
    match_id,
    invited_user_id,
    token_hash,
    created_by,
    expires_at,
    note
  )
  values (
    p_match_id,
    p_invited_user_id,
    v_token_hash,
    v_user_id,
    now() + interval '14 days',
    v_note
  )
  returning id into v_invitation_id;

  if p_invited_user_id is not null then
    select p.display_name
    into v_inviter_name
    from public.profiles as p
    where p.id = v_user_id;

    perform public.enqueue_notification(
      p_invited_user_id,
      'match_invitation',
      'match',
      p_match_id,
      format('match_invitation:%s', v_invitation_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', p_match_id),
        'params', jsonb_build_object('name', coalesce(v_inviter_name, ''))
      ),
      now()
    );
  end if;

  return v_token;
end;
$$;

revoke all on function public.create_match_invite(uuid, uuid, text) from public, anon;
grant execute on function public.create_match_invite(uuid, uuid, text) to authenticated;

drop function if exists public.join_match(uuid);

create or replace function public.join_match(
  p_match_id uuid,
  p_note text default null
)
returns public.participant_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_count integer;
  v_status public.participant_status;
  v_note text;
begin
  v_user_id := public.assert_marketplace_caller();
  v_match := public.assert_joinable_match(p_match_id, v_user_id, false);

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'already_participant';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(p_match_id);

  if v_match.requires_creator_approval then
    v_status := 'requested';
    v_note := public.sanitize_player_note(p_note);
  else
    if v_count >= v_capacity then
      raise exception using errcode = 'P0001', message = 'match_full';
    end if;
    v_status := 'accepted';
    -- Instant join has no host decision surface; ignore any smuggled note.
    v_note := null;
  end if;

  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status in ('left', 'declined', 'removed')
  ) then
    update public.match_participants
    set
      status = v_status,
      joined_at = case when v_status = 'accepted' then now() else null end,
      left_at = null,
      join_note = v_note
    where match_id = p_match_id
      and user_id = v_user_id;
  else
    insert into public.match_participants (
      match_id,
      user_id,
      status,
      is_creator,
      joined_at,
      join_note
    )
    values (
      p_match_id,
      v_user_id,
      v_status,
      false,
      case when v_status = 'accepted' then now() else null end,
      v_note
    );
  end if;

  if v_status = 'accepted' then
    perform public.refresh_match_open_state(p_match_id);
  end if;

  return v_status;
end;
$$;

revoke all on function public.join_match(uuid, text) from public, anon;
grant execute on function public.join_match(uuid, text) to authenticated;

alter type public.match_invite_inbox_row
  add attribute note text;

create or replace function public.list_my_match_invites()
returns setof public.match_invite_inbox_row
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
    mi.id,
    m.id,
    m.format,
    m.status,
    creator_profile.display_name,
    inviter_profile.display_name,
    public.match_participant_count(m.id),
    public.match_capacity_for_format(m.format),
    (
      select min(mto.starts_at)
      from public.match_time_options as mto
      where mto.match_id = m.id
        and mto.withdrawn_at is null
        and mto.ends_at > now()
    ),
    mi.expires_at,
    mi.created_at,
    mi.note
  from public.match_invitations as mi
  join public.matches as m on m.id = mi.match_id
  join public.profiles as creator_profile on creator_profile.id = m.creator_id
  join public.profiles as inviter_profile on inviter_profile.id = mi.created_by
  where mi.invited_user_id = v_user_id
    and mi.revoked_at is null
    and mi.accepted_at is null
    and mi.expires_at > now()
    and m.status in ('open', 'full')
    and public.match_participant_count(m.id)
      < public.match_capacity_for_format(m.format)
    and not exists (
      select 1
      from public.match_participants as mp
      where mp.match_id = m.id
        and mp.user_id = v_user_id
        and mp.status in ('accepted', 'requested', 'invited')
    )
  order by mi.created_at desc;
end;
$$;

revoke all on function public.list_my_match_invites() from public, anon;
grant execute on function public.list_my_match_invites() to authenticated;

-- get_match_hub from 064 with join_note on pending_requests.

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
  v_outcome_open boolean;
  v_viewer_side smallint;
  v_submitter_side smallint;
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
    v_viewer_side := case
      when v_user_id = any(v_result_row.side_a_user_ids) then 1 else 2
    end;
    v_submitter_side := case
      when v_result_row.submitted_by = any(v_result_row.side_a_user_ids) then 1 else 2
    end;

    v_result := jsonb_build_object(
      'result_id', v_result_row.id,
      'status', v_result_row.status,
      'submitted_by', v_result_row.submitted_by,
      'submitted_by_name', (
        select p.display_name
        from public.profiles as p
        where p.id = v_result_row.submitted_by
      ),
      'score', v_result_row.score,
      'side_a_user_ids', to_jsonb(v_result_row.side_a_user_ids),
      'winning_side', v_result_row.winning_side,
      'winner_user_id', v_result_row.winner_user_id,
      'viewer_side', v_viewer_side,
      'viewer_won', v_viewer_side = v_result_row.winning_side,
      'revision', v_result_row.revision,
      'confirmed_by', v_result_row.confirmed_by,
      'disputed_by', v_result_row.disputed_by,
      'dispute_note', v_result_row.dispute_note
    );
  end if;

  v_outcome_open := public.match_result_entry_open(p_match_id);

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

  select mto.starts_at, mto.ends_at
  into v_card.agreed_starts_at, v_card.agreed_ends_at
  from public.match_time_options as mto
  where mto.id = v_match.selected_time_option_id;

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
  v_card.preferred_clubs := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'club_id', c.id,
          'name', c.name,
          'booking_mode', c.booking_mode
        )
        order by c.name
      ),
      '[]'::jsonb
    )
    from public.match_preferred_clubs as mpc
    join public.clubs as c on c.id = mpc.club_id
    where mpc.match_id = v_match.id
      and c.is_active = true
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
      and (
        mto.ends_at > now()
        or mto.id = v_match.selected_time_option_id
      )
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
          'status', mp.status,
          'join_note', mp.join_note
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

  -- Attendance first, because it is what completes the match.
  elsif v_match.status in ('in_progress', 'completed')
     and v_participant_status = 'accepted'
     and coalesce(v_viewer_attendance, 'unknown') = 'unknown'
     and v_outcome_open then
    v_card.next_action := 'record_attendance';

  elsif v_match.status in ('in_progress', 'completed')
     and v_participant_status = 'accepted'
     and v_result is null
     and v_outcome_open then
    v_card.next_action := 'submit_result';

  elsif v_match.status in ('in_progress', 'completed')
     and v_participant_status = 'accepted'
     and v_result is not null
     and (v_result->>'status') = 'submitted'
     and (v_result->>'submitted_by')::uuid <> v_user_id
     and v_viewer_side <> v_submitter_side then
    v_card.next_action := 'confirm_result';

  -- The one reopen belongs to whoever objected.
  elsif v_result is not null
     and (v_result->>'status') = 'disputed'
     and (v_result->>'disputed_by')::uuid = v_user_id
     and (v_result->>'revision')::integer = 1 then
    v_card.next_action := 'resubmit_result';

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
