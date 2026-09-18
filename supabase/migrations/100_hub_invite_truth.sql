-- The hub tells the truth about who has been asked.
--
-- Four defects in one payload, all of them in `invited_players` or the
-- `next_action` chain beside it.
--
--   * **Only the host could see it.** `093` scoped the list to the creator, but
--     any accepted participant may invite. Every other inviter saw nothing and
--     was offered a second invite to a player they had already asked.
--   * **A player could appear twice in one section** -- once `declined`, once
--     `invited` -- after declining and being invited again.
--   * **A player could appear in two sections at once**, listed as invited
--     while also holding a live `requested` or `accepted` roster row.
--   * **A pending requester had no `next_action`.** They fell through to
--     `view_match`, so the hub never said "you are waiting on the host".
--
-- `099` also added a state this payload could not express: a suspended
-- invitation reported as `invited`, which told the host somebody was "waiting
-- to answer" when the seat they were offered was already taken.

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
  v_card.cancellation_reason := v_match.cancellation_reason;
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
          'attendance', mp.attendance,
          'avatar_path', p.avatar_path
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
  -- Widened from host-only, de-duplicated, and now reports suspension.
  --
  -- **Audience.** `093` gave this to the creator alone, but `create_match_invite`
  -- authorises any accepted participant -- deliberately, it is what lets
  -- somebody who joined a doubles match go and find the fourth. So every other
  -- inviter saw an empty list and was offered a second invite to a player they
  -- had already asked, which is the exact failure `093` was written to stop.
  -- Pending and suspended invitations now go to every accepted participant.
  -- A **decline** still does not: `093` reasoned that a refusal is the
  -- inviter's business rather than the roster's, and that holds -- so a decline
  -- reaches the creator, and the person who sent that invitation, and nobody
  -- else.
  --
  -- **One row per player.** Without `distinct on`, a player who declined and
  -- was invited again appeared twice in one section, once as each.
  --
  -- A live invitation outranks a terminal one, and only then does recency
  -- decide. Ordering on `created_at` alone is not enough: `now()` is
  -- transaction-stable, so a decline and the re-invite that follows it inside
  -- one transaction carry the identical timestamp and the winner would be
  -- arbitrary. `id` breaks any remaining tie so the answer is at least stable.
  --
  -- **Not a participant.** A player invited who then arrived under their own
  -- steam held both an invitation and a roster row, and was listed in two
  -- sections at once. The roster row is the live fact.
  v_card.invited_players := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', latest.user_id,
          'display_name', latest.display_name,
          'status', latest.status,
          'avatar_path', latest.avatar_path
        )
        order by latest.declined_at nulls first, latest.display_name
      ),
      '[]'::jsonb
    )
    from (
      select distinct on (mi.invited_user_id)
        p.id as user_id,
        p.display_name,
        p.avatar_path,
        mi.declined_at,
        case
          when mi.declined_at is not null then 'declined'
          when mi.superseded_at is not null then 'superseded'
          else 'invited'
        end as status
      from public.match_invitations as mi
      join public.profiles as p on p.id = mi.invited_user_id
      where mi.match_id = v_match.id
        and mi.accepted_at is null
        and v_participant_status = 'accepted'
        and (
          (
            mi.declined_at is not null
            and (coalesce(v_is_creator, false) or mi.created_by = v_user_id)
          )
          or (mi.revoked_at is null and mi.expires_at > now())
        )
        and not exists (
          select 1
          from public.match_participants as mp
          where mp.match_id = v_match.id
            and mp.user_id = mi.invited_user_id
            and mp.status in ('accepted', 'requested')
        )
      order by
        mi.invited_user_id,
        (mi.revoked_at is null and mi.declined_at is null) desc,
        mi.created_at desc,
        mi.id desc
    ) as latest
  );
  v_card.pending_requests := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', p.id,
          'display_name', p.display_name,
          'status', mp.status,
          'join_note', mp.join_note,
          'avatar_path', p.avatar_path
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
  -- The one fact that matters on this screen for somebody who has asked and not
  -- been answered. Without it they fell through to `view_match`, and the state
  -- was carried only by the presence of a withdraw link.
  elsif v_participant_status = 'requested' then
    v_card.next_action := 'request_pending';
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

-- `get_match_hub` was already granted in an earlier migration and
-- `create or replace` preserves the ACL; re-stated because this widens who the
-- payload answers, and that is worth being explicit about.
revoke all on function public.get_match_hub(uuid) from public, anon;
grant execute on function public.get_match_hub(uuid) to authenticated;
