-- Court handoff tracking: record that a host reached out to a club about a
-- match, and whether the request was actually sent.
--
-- v1 secures courts over WhatsApp. `openWhatsAppBooking` opened the link and
-- recorded nothing, and `confirm_external_court` (034) creates a booking that is
-- already accepted -- so a match jumped `ready_to_book` -> `confirmed` in a
-- single step and the window in between was invisible to the product. Nothing
-- could nudge on it (`booking_stale_participant` in 022 needs a `bookings` row
-- at status 'requested', which does not exist on this path), nothing could
-- offer the next club on the shortlist, and the pilot could not separate
-- "players never agreed" from "the club never replied".
--
-- Deliberately NOT the `bookings` table. A booking carries club-staff
-- visibility, court overlap constraints and a dashboard queue; a reach-out is
-- an attempt, not a booking, and the number worth measuring is how many
-- attempts a match needed. Several rows per match is the point.
--
-- Scope is record-and-measure only. No notification, no next-club fallback and
-- no chat posting is wired here -- those are separate decisions.

create type public.court_request_status as enum ('opened', 'sent', 'not_sent');

create table public.match_court_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  club_id uuid not null references public.clubs(id),
  requested_by uuid not null references public.player_profiles(user_id),
  status public.court_request_status not null default 'opened',
  /** When the host tapped through to the club. */
  opened_at timestamptz not null default now(),
  /** When the host said whether they actually sent it. Null while unanswered. */
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index match_court_requests_match_idx
  on public.match_court_requests (match_id, opened_at desc);

create index match_court_requests_club_idx
  on public.match_court_requests (club_id, opened_at desc);

-- One live reach-out per club per match: tapping Contact a second time before
-- answering is a retry of the same attempt, not a new one.
create unique index match_court_requests_open_unique
  on public.match_court_requests (match_id, club_id)
  where status = 'opened';

alter table public.match_court_requests enable row level security;

-- `is_match_chat_participant` (019) is named for chat but is the generic
-- "accepted participant of this match" predicate. Reused rather than duplicated.
-- Writes have no policy on purpose: the security-definer RPCs below are the
-- only way in.
create policy match_court_requests_select_participant
  on public.match_court_requests
  for select
  to authenticated
  using (public.is_match_chat_participant(match_id));

-- Default privileges hand anon and authenticated TRUNCATE/TRIGGER/REFERENCES on
-- a new public table. Stripped, then SELECT granted back to authenticated only
-- -- without a table grant the policy above can never run, which would leave a
-- policy in the schema that reads as protection but is unreachable.
revoke all on table public.match_court_requests from anon, authenticated;
grant select on table public.match_court_requests to authenticated;

/**
 * Records that the host opened a club's booking channel for this match.
 * Returns the request id so the client can answer it on return.
 */
create or replace function public.record_court_request_opened(
  p_match_id uuid,
  p_club_id uuid
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
  v_request_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  -- Host-only, matching confirm_external_court (058): contacting a club commits
  -- the group to a venue, so it is the creator's call.
  if v_match.creator_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the creator can contact a club';
  end if;

  if not exists (select 1 from public.clubs as c where c.id = p_club_id) then
    raise exception using errcode = 'P0002', message = 'Club not found';
  end if;

  -- The update is a no-op that exists to force RETURNING on conflict, which
  -- keeps the original `opened_at` rather than resetting the attempt clock.
  insert into public.match_court_requests (match_id, club_id, requested_by)
  values (p_match_id, p_club_id, v_user_id)
  on conflict (match_id, club_id) where status = 'opened'
  do update set requested_by = excluded.requested_by
  returning id into v_request_id;

  return v_request_id;
end;
$$;

/**
 * Host answers "did you actually send it?". Only the host who opened the
 * request may answer, and only while it is still unanswered.
 */
create or replace function public.answer_court_request(
  p_request_id uuid,
  p_sent boolean
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

  update public.match_court_requests as mcr
  set
    status = case when p_sent then 'sent' else 'not_sent' end::public.court_request_status,
    answered_at = now()
  where mcr.id = p_request_id
    and mcr.requested_by = v_user_id
    and mcr.status = 'opened';

  if not found then
    raise exception using errcode = 'P0002', message = 'Court request not found';
  end if;
end;
$$;

/**
 * Court reach-outs for a match, newest first. Visible to every accepted
 * participant -- a joiner waiting on a court can see that one was asked for,
 * which is the state the hub previously had no way to show.
 */
create or replace function public.list_match_court_requests(
  p_match_id uuid
)
returns table (
  request_id uuid,
  club_id uuid,
  club_name text,
  status public.court_request_status,
  opened_at timestamptz,
  answered_at timestamptz,
  is_viewer_request boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  if not public.is_match_chat_participant(p_match_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Match access required';
  end if;

  return query
  select
    mcr.id,
    mcr.club_id,
    c.name,
    mcr.status,
    mcr.opened_at,
    mcr.answered_at,
    mcr.requested_by = v_user_id
  from public.match_court_requests as mcr
  join public.clubs as c on c.id = mcr.club_id
  where mcr.match_id = p_match_id
  order by mcr.opened_at desc;
end;
$$;

revoke all on function public.record_court_request_opened(uuid, uuid) from public, anon;
grant execute on function public.record_court_request_opened(uuid, uuid) to authenticated;

revoke all on function public.answer_court_request(uuid, boolean) from public, anon;
grant execute on function public.answer_court_request(uuid, boolean) to authenticated;

revoke all on function public.list_match_court_requests(uuid) from public, anon;
grant execute on function public.list_match_court_requests(uuid) to authenticated;
