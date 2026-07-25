-- Tennis Lebanon initial schema
-- Apply to a fresh Supabase/PostgreSQL project. Feature milestones must add
-- detailed RLS policies and privileged RPCs before exposing new behavior.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.account_status as enum ('active', 'suspended', 'deletion_requested', 'deleted');
create type public.skill_band as enum ('beginner', 'improving', 'intermediate', 'advanced', 'competitive');
create type public.play_intent as enum ('social', 'competitive', 'either');
create type public.match_format as enum ('singles', 'doubles');
create type public.match_visibility as enum ('public', 'invite_only', 'private');
create type public.match_status as enum ('draft', 'open', 'full', 'ready_to_book', 'booking_pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'expired', 'disputed');
create type public.participant_status as enum ('invited', 'requested', 'accepted', 'declined', 'left', 'removed');
create type public.attendance_status as enum ('unknown', 'attended', 'cancelled_in_time', 'late_cancel', 'no_show', 'excused', 'disputed');
create type public.booking_status as enum ('requested', 'alternative_proposed', 'accepted', 'rejected', 'cancelled', 'completed');
create type public.club_role as enum ('staff', 'admin');
create type public.platform_role as enum ('support', 'admin');
create type public.vote_value as enum ('yes', 'no');
create type public.result_status as enum ('submitted', 'confirmed', 'disputed', 'resolved');
create type public.report_status as enum ('open', 'investigating', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 50),
  avatar_path text,
  birth_year smallint check (birth_year between 1900 and extract(year from current_date)::int),
  is_adult_confirmed boolean not null default false,
  languages text[] not null default array['en']::text[],
  account_status public.account_status not null default 'active',
  onboarding_completed_at timestamptz,
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  privacy_accepted_at timestamptz,
  community_rules_version text,
  community_rules_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  skill_band public.skill_band not null,
  play_intent public.play_intent not null default 'either',
  prefers_singles boolean not null default true,
  prefers_doubles boolean not null default false,
  internal_rating integer not null default 1200 check (internal_rating between 100 and 3000),
  rated_match_count integer not null default 0 check (rated_match_count >= 0),
  bio text check (char_length(bio) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null default 'LB',
  city_code text not null,
  slug text not null,
  name_i18n jsonb not null,
  timezone text not null default 'Asia/Beirut',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  unique(country_code, city_code, slug)
);

create table public.player_zones (
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete cascade,
  priority smallint not null default 1 check (priority between 1 and 10),
  primary key (user_id, zone_id)
);

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  weekday smallint check (weekday between 0 and 6),
  local_start time,
  local_end time,
  timezone text not null default 'Asia/Beirut',
  valid_from date,
  valid_until date,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (is_recurring = false and starts_at is not null and ends_at > starts_at and weekday is null)
    or
    (is_recurring = true and weekday is not null and local_start is not null and local_end is not null and starts_at is null and ends_at is null)
  )
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id),
  name text not null,
  slug text not null unique,
  description text,
  address_public text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  booking_mode text not null default 'manual_request' check (booking_mode in ('manual_request', 'external_link', 'realtime')),
  amenities text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_private_contacts (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  booking_phone text,
  booking_email text,
  internal_note text,
  updated_at timestamptz not null default now()
);

create table public.club_memberships (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.club_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.platform_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.platform_role not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  surface text not null check (surface in ('hard', 'clay', 'grass', 'carpet', 'other')),
  is_indoor boolean not null default false,
  price_minor integer check (price_minor >= 0),
  currency char(3) check (currency is null or char_length(currency) = 3),
  slot_minutes integer not null default 60 check (slot_minutes between 30 and 240),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(club_id, name)
);

create table public.court_operating_hours (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  valid_from date,
  valid_until date,
  check (closes_at > opens_at)
);

create table public.court_blocks (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.player_profiles(user_id),
  format public.match_format not null,
  visibility public.match_visibility not null default 'public',
  status public.match_status not null default 'draft',
  intent public.play_intent not null default 'either',
  min_skill public.skill_band not null,
  max_skill public.skill_band not null,
  requires_creator_approval boolean not null default false,
  notes text check (char_length(notes) <= 500),
  selected_time_option_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text
);

create table public.match_zones (
  match_id uuid not null references public.matches(id) on delete cascade,
  zone_id uuid not null references public.zones(id),
  primary key (match_id, zone_id)
);

create table public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.player_profiles(user_id),
  status public.participant_status not null,
  is_creator boolean not null default false,
  attendance public.attendance_status not null default 'unknown',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table public.match_time_options (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  proposed_by uuid not null references public.player_profiles(user_id),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique(match_id, starts_at, ends_at)
);

alter table public.matches
  add constraint matches_selected_time_fk
  foreign key (selected_time_option_id) references public.match_time_options(id);

create table public.match_time_votes (
  time_option_id uuid not null references public.match_time_options(id) on delete cascade,
  user_id uuid not null references public.player_profiles(user_id),
  vote public.vote_value not null,
  updated_at timestamptz not null default now(),
  primary key (time_option_id, user_id)
);

create table public.match_invitations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  invited_user_id uuid references public.player_profiles(user_id),
  token_hash text,
  created_by uuid not null references public.player_profiles(user_id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (invited_user_id is not null or token_hash is not null)
);

create unique index match_invitation_token_hash_unique
  on public.match_invitations(token_hash)
  where token_hash is not null;

create table public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  author_id uuid not null references public.player_profiles(user_id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id),
  court_id uuid not null references public.courts(id),
  requested_by uuid not null references public.player_profiles(user_id),
  status public.booking_status not null default 'requested',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_minor integer check (price_minor >= 0),
  currency char(3),
  payment_method text not null default 'pay_at_club',
  club_note text,
  acted_by uuid references public.profiles(id),
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.bookings
  add constraint no_overlapping_accepted_court_bookings
  exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'accepted');

create unique index one_active_booking_per_match
  on public.bookings(match_id)
  where status in ('requested', 'alternative_proposed', 'accepted');

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  actor_id uuid references public.profiles(id),
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id),
  submitted_by uuid not null references public.player_profiles(user_id),
  status public.result_status not null default 'submitted',
  score jsonb not null,
  winner_user_id uuid references public.player_profiles(user_id),
  confirmed_by uuid references public.player_profiles(user_id),
  confirmed_at timestamptz,
  dispute_note text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rating_events (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.match_results(id),
  user_id uuid not null references public.player_profiles(user_id),
  rating_before integer not null,
  rating_after integer not null,
  algorithm_version text not null,
  created_at timestamptz not null default now(),
  unique(result_id, user_id)
);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  reported_user_id uuid references public.profiles(id),
  match_id uuid references public.matches(id),
  message_id uuid references public.match_messages(id),
  category text not null,
  note text check (char_length(note) <= 2000),
  status public.report_status not null default 'open',
  assigned_to uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (reported_user_id is not null or match_id is not null or message_id is not null)
);

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, device_id),
  unique(token)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  entity_type text,
  entity_id uuid,
  deduplication_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index matches_discovery_idx on public.matches(status, visibility, format, intent, created_at desc);
create index match_participants_user_idx on public.match_participants(user_id, status);
create index match_times_match_idx on public.match_time_options(match_id, starts_at) where withdrawn_at is null;
create index bookings_court_time_idx on public.bookings(court_id, starts_at, ends_at);
create index bookings_status_time_idx on public.bookings(status, starts_at);
create index messages_match_time_idx on public.match_messages(match_id, created_at);
create index notifications_due_idx on public.notifications(scheduled_at) where sent_at is null and failed_at is null;
create index reports_queue_idx on public.user_reports(status, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger player_profiles_updated_at before update on public.player_profiles
for each row execute function public.set_updated_at();
create trigger clubs_updated_at before update on public.clubs
for each row execute function public.set_updated_at();
create trigger club_private_contacts_updated_at before update on public.club_private_contacts
for each row execute function public.set_updated_at();
create trigger matches_updated_at before update on public.matches
for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();
create trigger results_updated_at before update on public.match_results
for each row execute function public.set_updated_at();

-- Secure-by-default baseline. Add explicit, tested policies with each milestone.
alter table public.profiles enable row level security;
alter table public.player_profiles enable row level security;
alter table public.zones enable row level security;
alter table public.player_zones enable row level security;
alter table public.availability_windows enable row level security;
alter table public.clubs enable row level security;
alter table public.club_private_contacts enable row level security;
alter table public.club_memberships enable row level security;
alter table public.platform_roles enable row level security;
alter table public.courts enable row level security;
alter table public.court_operating_hours enable row level security;
alter table public.court_blocks enable row level security;
alter table public.matches enable row level security;
alter table public.match_zones enable row level security;
alter table public.match_participants enable row level security;
alter table public.match_time_options enable row level security;
alter table public.match_time_votes enable row level security;
alter table public.match_invitations enable row level security;
alter table public.match_messages enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.match_results enable row level security;
alter table public.rating_events enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

-- Safe baseline reads for active venue discovery. Additional policies belong
-- to their feature migrations and must be covered by database authorization tests.
create policy zones_read_active on public.zones
for select to authenticated using (is_active = true);

create policy clubs_read_active on public.clubs
for select to authenticated using (is_active = true);

create policy courts_read_active on public.courts
for select to authenticated using (
  is_active = true
  and exists (
    select 1 from public.clubs c
    where c.id = courts.club_id and c.is_active = true
  )
);

create policy profiles_read_own on public.profiles
for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy player_profiles_read_own on public.player_profiles
for select to authenticated using (user_id = auth.uid());
create policy player_profiles_update_own on public.player_profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy player_zones_manage_own on public.player_zones
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy availability_manage_own on public.availability_windows
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy blocks_manage_own on public.user_blocks
for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy push_tokens_manage_own on public.device_push_tokens
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_read_own on public.notifications
for select to authenticated using (user_id = auth.uid());

comment on schema public is 'Tennis Lebanon MVP. All client-accessed tables require tested RLS policies.';
