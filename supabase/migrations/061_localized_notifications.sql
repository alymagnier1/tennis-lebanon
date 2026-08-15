-- Milestone 8.14: notifications in the recipient's language, and the three
-- events players expected that fired nothing.
--
-- Part 1 — language. Every notification was English in all three languages.
-- Each enqueue site built its copy as a SQL literal, and both renderers
-- preferred that literal over their own translations, so the `notifications.*`
-- strings in packages/i18n were never rendered at all. Fixing the renderers
-- needs a server-side notion of each user's UI language, which until now lived
-- only in the device's SecureStore. `profiles.languages` is *spoken* languages
-- used for player matching and is not that.
--
-- The literals stay where they are. They are no longer what renders: both
-- surfaces now key off `kind` and fall back to the literal only for a kind they
-- do not recognise. Rewriting all 21 enqueue sites would mean redefining a
-- dozen large functions — a refactor mixed into new behaviour, which
-- docs/DECISIONS.md and CLAUDE.md both argue against.
--
-- Part 2 — the missing events. `join_match`, `accept_match_invitation`,
-- `respond_to_join_request`, `leave_match`, `withdraw_from_booked_match` and
-- `send_match_message` all enqueued nothing, so a player joining, a player
-- dropping out of a booked match, and a new chat message were silent. These are
-- added as AFTER triggers rather than edits to those six functions: one trigger
-- on match_participants covers every join and leave path at once, including any
-- added later, and no existing function body has to be rewritten to get it.
-- Precedent: match_participants_touch_activity (056:155).

-- ---------------------------------------------------------------------------
-- Recipient language
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists notification_locale text not null default 'en';

do $constraint$
begin
  alter table public.profiles
    add constraint profiles_notification_locale_supported
    check (notification_locale in ('en', 'ar', 'fr'));
exception
  when duplicate_object then null;
end;
$constraint$;

comment on column public.profiles.notification_locale is
  'UI language for notification copy. Set by the mobile app; not the same as profiles.languages, which is spoken languages used for matching.';

create or replace function public.set_own_notification_locale(p_locale text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_locale text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  v_locale := lower(nullif(trim(coalesce(p_locale, '')), ''));

  if v_locale is null or v_locale not in ('en', 'ar', 'fr') then
    raise exception using errcode = 'P0001', message = 'unsupported_locale';
  end if;

  -- Own row only: the caller's id comes from the JWT, never from an argument.
  update public.profiles
  set notification_locale = v_locale,
      updated_at = now()
  where id = v_user_id;

  return v_locale;
end;
$$;

revoke all on function public.set_own_notification_locale(text) from public, anon;
grant execute on function public.set_own_notification_locale(text) to authenticated;

-- Additive column on the claim: the Edge Function reads fields by name, so an
-- older deploy keeps working against this signature until it ships.
drop function if exists public.claim_due_notifications(integer);

create or replace function public.claim_due_notifications(p_limit integer default 50)
returns table (
  notification_id uuid,
  user_id uuid,
  kind text,
  payload jsonb,
  push_tokens text[],
  attempt_count integer,
  locale text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  return query
  with due as (
    select n.id
    from public.notifications as n
    where n.sent_at is null
      and n.failed_at is null
      and n.scheduled_at <= now()
      and n.attempt_count < 3
    order by n.scheduled_at, n.created_at
    limit v_limit
    for update skip locked
  ),
  bumped as (
    update public.notifications as n
    set attempt_count = n.attempt_count + 1
    from due as d
    where n.id = d.id
    returning n.id, n.user_id, n.kind, n.payload, n.attempt_count
  )
  select
    b.id,
    b.user_id,
    b.kind,
    b.payload,
    coalesce(
      array_agg(dpt.token order by dpt.last_seen_at desc)
        filter (where dpt.token is not null),
      '{}'::text[]
    ),
    b.attempt_count,
    coalesce(p.notification_locale, 'en')
  from bumped as b
  left join public.device_push_tokens as dpt
    on dpt.user_id = b.user_id
   and dpt.is_active = true
  left join public.profiles as p
    on p.id = b.user_id
  group by b.id, b.user_id, b.kind, b.payload, b.attempt_count, p.notification_locale;
end;
$$;

revoke all on function public.claim_due_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Fan-out helper
-- ---------------------------------------------------------------------------

-- Enqueues one notification per accepted participant, skipping the person who
-- caused the event. `p_dedup_scope` is appended per recipient, so callers
-- control collapsing: a stable scope fires once ever, a time-bucketed one
-- throttles.
create or replace function public.notify_match_participants(
  p_match_id uuid,
  p_kind text,
  p_exclude_user_id uuid,
  p_dedup_scope text
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_notification_id uuid;
  v_participant record;
begin
  for v_participant in
    select mp.user_id
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.status = 'accepted'
      and (p_exclude_user_id is null or mp.user_id <> p_exclude_user_id)
  loop
    v_notification_id := public.enqueue_notification(
      v_participant.user_id,
      p_kind,
      'match',
      p_match_id,
      format('%s:%s:%s', p_kind, p_dedup_scope, v_participant.user_id),
      jsonb_build_object('deepLink', format('/match/%s', p_match_id)),
      now()
    );

    if v_notification_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.notify_match_participants(uuid, text, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Someone joined, someone left
-- ---------------------------------------------------------------------------

create or replace function public.notify_match_roster_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_was_accepted boolean;
  v_bucket bigint;
begin
  -- OLD is unassigned on INSERT and PL/pgSQL evaluates the whole boolean
  -- expression as one SQL query rather than short-circuiting, so this has to
  -- branch on tg_op before touching old.
  if tg_op = 'INSERT' then
    v_was_accepted := false;
  else
    v_was_accepted := old.status = 'accepted';
  end if;

  -- Same 15-minute bucket the chat throttle uses. A player who joins, leaves
  -- and rejoins within a few minutes collapses to one notification of each
  -- kind, while a genuine drop-out hours later still gets through.
  v_bucket := floor(extract(epoch from now()) / 900)::bigint;

  if new.status = 'accepted' and not v_was_accepted then
    perform public.notify_match_participants(
      new.match_id,
      'match_participant_joined',
      new.user_id,
      format('%s:%s:%s', new.match_id, new.user_id, v_bucket)
    );
  elsif v_was_accepted and new.status in ('left', 'removed') then
    perform public.notify_match_participants(
      new.match_id,
      'match_participant_left',
      new.user_id,
      format('%s:%s:%s', new.match_id, new.user_id, v_bucket)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists match_participants_notify_roster on public.match_participants;

create trigger match_participants_notify_roster
  after insert or update on public.match_participants
  for each row execute function public.notify_match_roster_change();

-- ---------------------------------------------------------------------------
-- New chat message
-- ---------------------------------------------------------------------------

create or replace function public.notify_match_message()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    return null;
  end if;

  -- One notification per recipient per 15-minute bucket. A four-player match
  -- having a back-and-forth would otherwise fire a push per message; the
  -- existing unique constraint on deduplication_key does the throttling, so
  -- this needs no state of its own.
  --
  -- The message body is never put in the payload. CLAUDE.md forbids logging
  -- message bodies, and a lock-screen preview is the same exposure.
  perform public.notify_match_participants(
    new.match_id,
    'match_message',
    new.author_id,
    format(
      '%s:%s',
      new.match_id,
      floor(extract(epoch from now()) / 900)::bigint
    )
  );

  return null;
end;
$$;

drop trigger if exists match_messages_notify on public.match_messages;

create trigger match_messages_notify
  after insert on public.match_messages
  for each row execute function public.notify_match_message();

-- ---------------------------------------------------------------------------
-- Structured params for the three kinds whose copy interpolates values
-- ---------------------------------------------------------------------------
--
-- These three built their body with format(), baking a club name, a Beirut
-- wall-clock string and a count into English prose. A localized template cannot
-- recover those, so the values move into `params` and the catalogue
-- interpolates them per language. `startsAt` is carried as UTC ISO-8601 and
-- rendered in Asia/Beirut by whichever surface displays it, per CLAUDE.md.
--
-- Bodies below are otherwise byte-identical to their previous definitions; only
-- the payload object changed.

create or replace function public.court_first_roster_reminders()
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
      m.creator_id,
      b.id as booking_id,
      b.starts_at,
      c.name as club_name,
      public.match_capacity_for_format(m.format)
        - public.match_participant_count(m.id) as spots_left
    from public.matches as m
    join public.bookings as b
      on b.match_id = m.id
     and b.status = 'accepted'
    join public.courts as ct on ct.id = b.court_id
    join public.clubs as c on c.id = ct.club_id
    where m.status in ('open', 'full')
      and b.starts_at > now()
      and b.starts_at <= now() + interval '24 hours'
      and public.match_participant_count(m.id)
          < public.match_capacity_for_format(m.format)
  loop
    v_notification_id := public.enqueue_notification(
      v_row.creator_id,
      'court_first_roster_short',
      'match',
      v_row.match_id,
      format('court_first_roster_short:%s:%s', v_row.booking_id, v_row.creator_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', v_row.match_id),
        'title', 'Court booked, players missing',
        'body', format(
          'Your court at %s is on %s and you still need %s more. Invite someone or release the court.',
          v_row.club_name,
          to_char(v_row.starts_at at time zone 'Asia/Beirut', 'Dy DD Mon, HH24:MI'),
          v_row.spots_left
        ),
        'params', jsonb_build_object(
          'clubName', v_row.club_name,
          'startsAt', to_char(v_row.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'spotsLeft', v_row.spots_left
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
        ),
        'params', jsonb_build_object(
          'startsAt', to_char(v_row.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
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

create or replace function public.release_external_court(
  p_match_id uuid,
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
  v_match public.matches%rowtype;
  v_booking public.bookings%rowtype;
  v_club_name text;
  v_note text;
  v_when text;
begin
  v_user_id := public.assert_marketplace_caller();
  v_note := nullif(trim(coalesce(p_reason, '')), '');

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  -- Host-only, matching confirm_external_court (058:51). Whoever committed the
  -- group to a venue is the one who can un-commit it.
  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the creator can release a court';
  end if;

  select *
  into v_booking
  from public.bookings as b
  where b.match_id = p_match_id
    and b.status = 'accepted'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No accepted court to release';
  end if;

  if v_booking.arranged_externally is distinct from true then
    raise exception using errcode = 'P0001', message = 'court_not_arranged_externally';
  end if;

  -- Once the hour has arrived the match either happened or did not, and that is
  -- what attendance and results are for. Releasing here would rewrite history.
  if v_booking.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'match_already_started';
  end if;

  update public.bookings
  set status = 'cancelled',
      acted_by = v_user_id,
      acted_at = now(),
      updated_at = now()
  where id = v_booking.id;

  perform public.append_booking_event(
    v_booking.id,
    'accepted',
    'cancelled',
    v_user_id,
    v_note,
    jsonb_build_object('released_by_host', true)
  );

  -- refresh_match_open_state owns the promotion to confirmed and only acts on
  -- open/full/ready_to_book, so hand it a status it accepts (058:240) and let it
  -- decide where the match lands now that the court is gone.
  update public.matches
  set status = 'ready_to_book', updated_at = now()
  where id = p_match_id
    and status = 'confirmed';

  perform public.refresh_match_open_state(p_match_id);

  select c.name
  into v_club_name
  from public.courts as ct
  join public.clubs as c on c.id = ct.club_id
  where ct.id = v_booking.court_id;

  -- These people were told the court was booked, by name and hour. Naming it
  -- again is the only way the correction lands on the same fact.
  v_when := to_char(v_booking.starts_at at time zone 'Asia/Beirut', 'Dy DD Mon, HH24:MI');

  perform public.enqueue_notification(
    mp.user_id,
    'match_court_released',
    'match',
    p_match_id,
    format('court_released:%s:%s', v_booking.id, mp.user_id),
    jsonb_build_object(
      'deepLink', format('/match/%s', p_match_id),
      'title', 'Court no longer booked',
      'body', format(
        '%s at %s fell through. The match still needs a court.',
        coalesce(v_club_name, 'The club'),
        v_when
      ),
      'params', jsonb_build_object(
        'clubName', coalesce(v_club_name, 'The club'),
        'startsAt', to_char(v_booking.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    ),
    now()
  )
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.status = 'accepted'
    and mp.user_id <> v_user_id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    v_user_id,
    'court_released_by_host',
    'match',
    p_match_id,
    v_note,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'court_id', v_booking.court_id,
      'starts_at', v_booking.starts_at
    )
  );
end;
$$;
