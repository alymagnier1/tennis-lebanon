-- Beirut prelaunch waitlist. A finished landing-page form is interest, not an account.
--
-- Writes happen from the dashboard route with the service role, which bypasses RLS.
-- anon and authenticated have no table privileges. Operators read through
-- list_prelaunch_signups, which checks assert_platform_operator().

create table public.prelaunch_signups (
  id uuid primary key default gen_random_uuid(),
  community text not null default 'beirut',
  first_name text not null,
  channel text not null,
  contact text not null,
  level text not null,
  court text,
  availability text[] not null,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  idempotency_key text not null,
  status text not null default 'waiting',
  claimed_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint prelaunch_signups_community_check check (community = 'beirut'),
  constraint prelaunch_signups_first_name_check check (
    char_length(btrim(first_name)) between 1 and 40
  ),
  constraint prelaunch_signups_channel_check check (channel in ('whatsapp', 'email')),
  constraint prelaunch_signups_level_check check (
    level in ('beginner', 'improving', 'intermediate', 'advanced', 'competitive')
  ),
  constraint prelaunch_signups_court_check check (
    court is null or char_length(court) <= 100
  ),
  constraint prelaunch_signups_availability_check check (
    cardinality(availability) >= 1
    and availability <@ array['wd-am', 'wd-pm', 'wd-ev', 'we-am', 'we-pm', 'we-ev']::text[]
  ),
  constraint prelaunch_signups_status_check check (
    status in ('waiting', 'invited', 'claimed', 'withdrawn')
  ),
  constraint prelaunch_signups_idempotency_key unique (idempotency_key),
  constraint prelaunch_signups_community_contact unique (community, contact)
);

create index prelaunch_signups_community_created_idx
  on public.prelaunch_signups (community, created_at desc);

alter table public.prelaunch_signups enable row level security;
revoke all on table public.prelaunch_signups from anon, authenticated;

-- Hashed client address and time, used only to refuse a burst. No raw IP.
create table public.prelaunch_signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index prelaunch_signup_attempts_ip_idx
  on public.prelaunch_signup_attempts (ip_hash, created_at desc);

alter table public.prelaunch_signup_attempts enable row level security;
revoke all on table public.prelaunch_signup_attempts from anon, authenticated;

create or replace function public.list_prelaunch_signups(p_community text default 'beirut')
returns table (
  id uuid,
  first_name text,
  channel text,
  contact text,
  level text,
  court text,
  availability text[],
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_operator();

  if p_community is distinct from 'beirut' then
    raise exception using errcode = 'P0001', message = 'Unknown prelaunch community';
  end if;

  return query
  select
    s.id,
    s.first_name,
    s.channel,
    s.contact,
    s.level,
    s.court,
    s.availability,
    s.status,
    s.created_at
  from public.prelaunch_signups as s
  where s.community = 'beirut'
  order by s.created_at desc
  limit 200;
end;
$$;

revoke all on function public.list_prelaunch_signups(text) from public, anon;
grant execute on function public.list_prelaunch_signups(text) to authenticated;
