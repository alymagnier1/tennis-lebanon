-- The last way a match still goes missing.
--
-- A match reaches ready_to_book -- roster full, hour agreed -- the group sorts
-- the court out over WhatsApp, and nobody records it. The hour passes and
-- expire_stale_matches quietly marks it expired a day later. They played. The
-- app captured no attendance, no result and no rating, and the completion
-- metric counted zero, which makes a match that happened indistinguishable
-- from one that fell apart.
--
-- Preferred clubs (045), court-first (046) and the editable hour (047) all make
-- it likelier a court gets recorded up front. This is the one that recovers
-- what still slips through, after the fact, when the answer is actually known:
-- before such a match expires, ask whether it happened.
--
-- A yes does not ask for a court. The completed match and the rating are the
-- objective and neither needs a booking, while insisting on one dead-ends
-- exactly where it matters most -- the club they played at is often not in the
-- directory. So the match goes straight to in_progress and the existing
-- attendance and result flow takes it from there. One person answering yes
-- cannot invent a result: submit_match_result still requires the other side to
-- confirm it.
--
-- A no expires the match, which is what would have happened anyway; answering
-- just makes it immediate and recorded rather than silent.
--
-- Only ready_to_book and booking_pending qualify, because both already imply a
-- full roster and an agreed hour. An open or full match never had the people,
-- and a court-first match that never filled expires on its court's own hour.

-- ---------------------------------------------------------------------------
-- 1. Which matches are worth asking about
-- ---------------------------------------------------------------------------

create or replace function public.match_awaiting_played_answer(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches as m
    join public.match_time_options as mto
      on mto.id = m.selected_time_option_id
    where m.id = p_match_id
      and m.status in ('ready_to_book', 'booking_pending')
      and mto.ends_at < now()
      and not exists (
        select 1
        from public.bookings as b
        where b.match_id = m.id
          and b.status = 'accepted'
      )
  );
$$;

revoke all on function public.match_awaiting_played_answer(uuid) from public, anon;
grant execute on function public.match_awaiting_played_answer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Answering it
-- ---------------------------------------------------------------------------

create or replace function public.report_match_played(
  p_match_id uuid,
  p_played boolean
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
  v_pending record;
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

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only a match participant can answer this';
  end if;

  if not public.match_awaiting_played_answer(p_match_id) then
    raise exception using errcode = 'P0001', message = 'match_not_awaiting_played_answer';
  end if;

  -- Whatever the answer, the club is no longer being waited on: either the
  -- group played without them or the match is over. Leaving a live request
  -- behind would let staff accept a court for a match that has moved on.
  for v_pending in
    select b.id, b.status
    from public.bookings as b
    where b.match_id = p_match_id
      and b.status in ('requested', 'alternative_proposed')
    for update
  loop
    update public.bookings
    set status = 'cancelled',
        acted_by = v_user_id,
        acted_at = now(),
        updated_at = now()
    where id = v_pending.id;

    perform public.append_booking_event(
      v_pending.id,
      v_pending.status,
      'cancelled',
      v_user_id,
      null,
      jsonb_build_object('superseded_by', 'played_answer')
    );
  end loop;

  if p_played then
    -- Straight past confirmed: there is no court to confirm, and the point of
    -- asking is to reach a completed match with a rating.
    update public.matches
    set status = 'in_progress', updated_at = now()
    where id = p_match_id;

    insert into public.audit_events (
      actor_id, action, entity_type, entity_id, metadata
    )
    values (
      v_user_id,
      'match_played_self_reported',
      'match',
      p_match_id,
      jsonb_build_object('previous_status', v_match.status)
    );

    perform public.enqueue_notification(
      mp.user_id,
      'match_played_confirmed',
      'match',
      p_match_id,
      format('match_played_confirmed:%s:%s', p_match_id, mp.user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', p_match_id),
        'title', 'Match marked as played',
        'body', 'Confirm your attendance and add the result so it counts.'
      ),
      now()
    )
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'accepted'
      and mp.user_id <> v_user_id;

    return;
  end if;

  update public.matches
  set status = 'expired', updated_at = now()
  where id = p_match_id;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    v_user_id,
    'match_reported_not_played',
    'match',
    p_match_id,
    jsonb_build_object('previous_status', v_match.status)
  );

  perform public.enqueue_notification(
    mp.user_id,
    'match_expired',
    'match',
    p_match_id,
    format('match_expired:%s:%s', p_match_id, mp.user_id),
    jsonb_build_object(
      'deepLink', format('/match/%s', p_match_id),
      'title', 'Match closed',
      'body', 'This match was marked as not played and has been closed.'
    ),
    now()
  )
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.status = 'accepted'
    and mp.user_id <> v_user_id;
end;
$$;

revoke all on function public.report_match_played(uuid, boolean) from public, anon;
grant execute on function public.report_match_played(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Asking, in the window before expiry
--
-- The agreed hour has to be properly past before the question makes sense, and
-- match_all_times_passed_grace does not expire until 24 hours after it, so
-- there is most of a day to answer.
-- ---------------------------------------------------------------------------

create or replace function public.match_played_prompts()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row record;
  v_notification_id uuid;
begin
  for v_row in
    select
      m.id as match_id,
      mp.user_id,
      mto.starts_at
    from public.matches as m
    join public.match_time_options as mto
      on mto.id = m.selected_time_option_id
    join public.match_participants as mp
      on mp.match_id = m.id
     and mp.status = 'accepted'
    where m.status in ('ready_to_book', 'booking_pending')
      and mto.ends_at < now() - interval '2 hours'
      and not exists (
        select 1
        from public.bookings as b
        where b.match_id = m.id
          and b.status = 'accepted'
      )
  loop
    v_notification_id := public.enqueue_notification(
      v_row.user_id,
      'match_played_prompt',
      'match',
      v_row.match_id,
      format('match_played_prompt:%s:%s', v_row.match_id, v_row.user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'Did you play?',
        'body', format(
          'Your match on %s never got a court in the app. Tell us if it happened so the result still counts.',
          to_char(v_row.starts_at at time zone 'Asia/Beirut', 'Dy DD Mon, HH24:MI')
        )
      ),
      now()
    );

    if v_notification_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.match_played_prompts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Attendance prompts must not depend on a booking
--
-- Copied forward from 024:3. The join onto accepted bookings meant a match
-- that reached in_progress by being self-reported got no attendance push at
-- all -- the answer the whole prompt exists to collect. The booking start is
-- still preferred where there is one; the agreed hour stands in otherwise.
-- ---------------------------------------------------------------------------

create or replace function public.schedule_attendance_prompts()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row record;
  v_notification_id uuid;
begin
  for v_row in
    select
      m.id as match_id,
      mp.user_id
    from public.matches as m
    join public.match_participants as mp
      on mp.match_id = m.id
     and mp.status = 'accepted'
    left join public.bookings as b
      on b.match_id = m.id
     and b.status = 'accepted'
    left join public.match_time_options as mto
      on mto.id = m.selected_time_option_id
    where m.status = 'in_progress'
      and mp.attendance = 'unknown'
      and now() >= coalesce(b.starts_at, mto.starts_at)
  loop
    v_notification_id := public.enqueue_notification(
      v_row.user_id,
      'attendance_prompt',
      'match',
      v_row.match_id,
      format('attendance_prompt:%s:%s', v_row.match_id, v_row.user_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'How did the match go?',
        'body', 'Confirm your attendance and submit the result when you are ready.'
      ),
      now()
    );

    if v_notification_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Run it alongside the rest
-- ---------------------------------------------------------------------------

create or replace function public.run_notification_jobs()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stale_reminders integer;
  v_expired_matches integer;
  v_booking_reminders jsonb;
  v_court_first_reminders integer;
  v_played_prompts integer;
begin
  v_stale_reminders := public.schedule_stale_match_reminders();
  v_booking_reminders := public.booking_stale_reminders();
  v_court_first_reminders := public.court_first_roster_reminders();

  -- Asked before the sweep, so a match gets its question in the window rather
  -- than being expired in the same run that would have raised it.
  v_played_prompts := public.match_played_prompts();
  v_expired_matches := public.expire_stale_matches();

  return jsonb_build_object(
    'stale_reminders_enqueued', v_stale_reminders,
    'matches_expired', v_expired_matches,
    'booking_reminders', v_booking_reminders,
    'court_first_reminders_enqueued', v_court_first_reminders,
    'played_prompts_enqueued', v_played_prompts
  );
end;
$$;
