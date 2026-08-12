-- A host had to restart the app to notice somebody joined, and the joiner had
-- to restart to notice the host had booked a court. The hub is a single
-- `get_match_hub` fetch whose cache is only ever invalidated by the device that
-- made the change, so nothing crosses between participants. Chat is live only
-- because `match_messages` carries a select policy, which is what Supabase
-- Realtime filters on.
--
-- Publishing `matches` or `match_participants` would deliver nothing: both have
-- RLS on with no policy, deliberately (see 045), because every read is meant to
-- go through a security definer RPC that shapes and filters the payload.
-- Realtime would evaluate that same empty policy set and drop every event.
-- Granting clients select on them to make it work would hand out the raw rows
-- the RPC exists to withhold.
--
-- So the only thing clients may read is a doorbell. `match_activity` holds a
-- match id the viewer is already cleared to see plus the time it last changed —
-- no participants, no times, no booking state. A client learns "something moved"
-- and re-reads through `get_match_hub`, which enforces exactly what it did
-- before. The privacy model is untouched; only the trigger to refetch is new.

create table public.match_activity (
  match_id uuid primary key references public.matches(id) on delete cascade,
  updated_at timestamptz not null default now()
);

comment on table public.match_activity is
  'Realtime doorbell: signals that a match changed, carrying no match data. Clients subscribe and refetch through get_match_hub.';

alter table public.match_activity enable row level security;

-- Select only. Writes arrive from triggers running inside the existing security
-- definer RPCs, so no client ever needs insert or update here.
grant select on table public.match_activity to authenticated;

-- `is_match_chat_participant` requires 'accepted', which would exclude the one
-- person most in need of a live update: a player whose join is still
-- 'requested', waiting to see the host accept it. This mirrors the participant
-- branch of get_match_hub's own guard instead.
--
-- It deliberately omits that function's other branch, where any signed-in user
-- may read a public listing. Those viewers are browsing, not coordinating, and
-- subscribing every browser to every open match is waste.
create or replace function public.is_match_activity_viewer(
  p_match_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = p_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  );
$$;

create policy match_activity_select_viewer on public.match_activity
  for select
  to authenticated
  using (public.is_match_activity_viewer(match_id));

alter publication supabase_realtime add table public.match_activity;

-- Triggers rather than edits to the fifteen or so mutating RPCs: instrumenting
-- each one by hand is invasive and silently misses whichever path gets added
-- next. A write to the underlying table is the fact we actually care about.

create or replace function public.touch_match_activity()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_match_id uuid;
begin
  v_match_id := case tg_op when 'DELETE' then old.match_id else new.match_id end;

  if v_match_id is not null then
    insert into public.match_activity (match_id, updated_at)
    values (v_match_id, now())
    on conflict (match_id) do update set updated_at = now();
  end if;

  return null;
end;
$$;

-- `matches` keys on `id`, not `match_id`.
create or replace function public.touch_match_activity_self()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_match_id uuid;
begin
  v_match_id := case tg_op when 'DELETE' then old.id else new.id end;

  -- A deleted match takes its ping with it via the cascade, so only touch on
  -- insert and update.
  if tg_op <> 'DELETE' and v_match_id is not null then
    insert into public.match_activity (match_id, updated_at)
    values (v_match_id, now())
    on conflict (match_id) do update set updated_at = now();
  end if;

  return null;
end;
$$;

-- `match_time_votes` keys on the option, so resolve the match through it.
create or replace function public.touch_match_activity_via_time_option()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_option_id uuid;
  v_match_id uuid;
begin
  v_option_id := case tg_op
    when 'DELETE' then old.time_option_id
    else new.time_option_id
  end;

  select mto.match_id into v_match_id
  from public.match_time_options as mto
  where mto.id = v_option_id;

  if v_match_id is not null then
    insert into public.match_activity (match_id, updated_at)
    values (v_match_id, now())
    on conflict (match_id) do update set updated_at = now();
  end if;

  return null;
end;
$$;

create trigger matches_touch_activity
  after insert or update on public.matches
  for each row execute function public.touch_match_activity_self();

create trigger match_participants_touch_activity
  after insert or update or delete on public.match_participants
  for each row execute function public.touch_match_activity();

create trigger bookings_touch_activity
  after insert or update or delete on public.bookings
  for each row execute function public.touch_match_activity();

create trigger match_time_options_touch_activity
  after insert or update or delete on public.match_time_options
  for each row execute function public.touch_match_activity();

create trigger match_time_votes_touch_activity
  after insert or update or delete on public.match_time_votes
  for each row execute function public.touch_match_activity_via_time_option();

create trigger match_results_touch_activity
  after insert or update or delete on public.match_results
  for each row execute function public.touch_match_activity();

create trigger match_preferred_clubs_touch_activity
  after insert or update or delete on public.match_preferred_clubs
  for each row execute function public.touch_match_activity();

create trigger match_invitations_touch_activity
  after insert or update or delete on public.match_invitations
  for each row execute function public.touch_match_activity();

-- `match_messages` is left out on purpose: chat already has its own channel, and
-- a ping per message would force a redundant full hub refetch on every line
-- typed. `match_zones` is set once at creation and never moves.

-- Give existing matches a row so the first subscribe has something to watch.
insert into public.match_activity (match_id, updated_at)
select m.id, now()
from public.matches as m
on conflict (match_id) do nothing;

revoke all on function public.is_match_activity_viewer(uuid, uuid) from public, anon;
grant execute on function public.is_match_activity_viewer(uuid, uuid) to authenticated;
