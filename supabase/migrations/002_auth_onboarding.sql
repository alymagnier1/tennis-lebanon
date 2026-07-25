-- Milestone 1: authentication, onboarding, and account deletion.

alter table public.profiles
  alter column display_name drop not null,
  add column deletion_requested_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_display_name_check;

alter table public.profiles
  add constraint profiles_display_name_check
  check (
    display_name is null
    or char_length(btrim(display_name)) between 2 and 50
  );

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, null)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public;

drop trigger if exists auth_user_create_profile on auth.users;
create trigger auth_user_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (id, display_name)
select users.id, null
from auth.users as users
on conflict (id) do nothing;

create or replace function public.complete_onboarding(
  p_display_name text,
  p_birth_year smallint,
  p_is_adult_confirmed boolean,
  p_languages text[],
  p_skill_band public.skill_band,
  p_play_intent public.play_intent,
  p_prefers_singles boolean,
  p_prefers_doubles boolean,
  p_zone_ids uuid[],
  p_terms_version text,
  p_privacy_version text,
  p_community_rules_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_languages text[];
  v_account_status public.account_status;
  v_current_year integer := extract(year from current_date)::integer;
  v_zone_count integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select p.account_status
  into v_account_status
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Profile not found';
  end if;

  if v_account_status <> 'active' then
    raise exception using
      errcode = '42501',
      message = 'Account is not active';
  end if;

  v_display_name := regexp_replace(btrim(p_display_name), '\s+', ' ', 'g');
  if v_display_name is null
     or char_length(v_display_name) not between 2 and 50 then
    raise exception using
      errcode = '22023',
      message = 'Display name must be 2 to 50 characters after normalization';
  end if;

  if p_birth_year is null
     or p_birth_year < 1900
     or p_birth_year > v_current_year - 18
     or p_is_adult_confirmed is distinct from true then
    raise exception using
      errcode = '22023',
      message = 'Adult attestation and an eligible birth year are required';
  end if;

  if p_languages is null
     or cardinality(p_languages) = 0
     or exists (
       select 1
       from unnest(p_languages) as supplied(language)
       where supplied.language is null
          or btrim(supplied.language) = ''
          or lower(btrim(supplied.language)) not in ('en', 'ar', 'fr')
     ) then
    raise exception using
      errcode = '22023',
      message = 'At least one supported language is required';
  end if;

  select array_agg(normalized.language order by normalized.first_position)
  into v_languages
  from (
    select
      lower(btrim(supplied.language)) as language,
      min(supplied.position) as first_position
    from unnest(p_languages) with ordinality as supplied(language, position)
    group by lower(btrim(supplied.language))
  ) as normalized;

  if p_skill_band is null or p_play_intent is null then
    raise exception using
      errcode = '22023',
      message = 'Skill band and play intent are required';
  end if;

  if p_prefers_singles is null
     or p_prefers_doubles is null
     or (p_prefers_singles = false and p_prefers_doubles = false) then
    raise exception using
      errcode = '22023',
      message = 'At least one match format is required';
  end if;

  if p_zone_ids is null
     or cardinality(p_zone_ids) = 0
     or cardinality(p_zone_ids) > 10
     or exists (
       select 1
       from unnest(p_zone_ids) as supplied(zone_id)
       where supplied.zone_id is null
     )
     or cardinality(p_zone_ids) <> (
       select count(distinct supplied.zone_id)
       from unnest(p_zone_ids) as supplied(zone_id)
     ) then
    raise exception using
      errcode = '22023',
      message = 'One to ten unique zones are required';
  end if;

  select count(*)
  into v_zone_count
  from public.zones as z
  where z.id = any(p_zone_ids)
    and z.is_active = true;

  if v_zone_count <> cardinality(p_zone_ids) then
    raise exception using
      errcode = '22023',
      message = 'Every selected zone must exist and be active';
  end if;

  if p_terms_version is distinct from 'dev-2026-07-25'
     or p_privacy_version is distinct from 'dev-2026-07-25'
     or p_community_rules_version is distinct from 'dev-2026-07-25' then
    raise exception using
      errcode = '22023',
      message = 'Current policy versions must be accepted';
  end if;

  update public.profiles
  set
    display_name = v_display_name,
    birth_year = p_birth_year,
    is_adult_confirmed = true,
    languages = v_languages,
    terms_version = p_terms_version,
    terms_accepted_at = now(),
    privacy_version = p_privacy_version,
    privacy_accepted_at = now(),
    community_rules_version = p_community_rules_version,
    community_rules_accepted_at = now(),
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_user_id;

  insert into public.player_profiles (
    user_id,
    skill_band,
    play_intent,
    prefers_singles,
    prefers_doubles
  )
  values (
    v_user_id,
    p_skill_band,
    p_play_intent,
    p_prefers_singles,
    p_prefers_doubles
  )
  on conflict (user_id) do update
  set
    skill_band = excluded.skill_band,
    play_intent = excluded.play_intent,
    prefers_singles = excluded.prefers_singles,
    prefers_doubles = excluded.prefers_doubles;

  delete from public.player_zones
  where user_id = v_user_id;

  insert into public.player_zones (user_id, zone_id, priority)
  select v_user_id, supplied.zone_id, supplied.position::smallint
  from unnest(p_zone_ids) with ordinality as supplied(zone_id, position);
end;
$$;

revoke all on function public.complete_onboarding(
  text,
  smallint,
  boolean,
  text[],
  public.skill_band,
  public.play_intent,
  boolean,
  boolean,
  uuid[],
  text,
  text,
  text
) from public, anon;
grant execute on function public.complete_onboarding(
  text,
  smallint,
  boolean,
  text[],
  public.skill_band,
  public.play_intent,
  boolean,
  boolean,
  uuid[],
  text,
  text,
  text
) to authenticated;

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_status public.account_status;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select p.account_status
  into v_account_status
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Profile not found';
  end if;

  if v_account_status = 'deleted' then
    raise exception using
      errcode = '42501',
      message = 'Account is deleted';
  end if;

  if v_account_status <> 'deletion_requested' then
    update public.profiles
    set
      account_status = 'deletion_requested',
      deletion_requested_at = now()
    where id = v_user_id;

    insert into public.audit_events (
      actor_id,
      action,
      entity_type,
      entity_id
    )
    values (
      v_user_id,
      'account_deletion_requested',
      'profile',
      v_user_id
    );
  end if;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

-- Data API roles receive only the table privileges needed by Milestone 1.
-- RLS remains the row-level authorization boundary.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (avatar_path) on table public.profiles to authenticated;

revoke all on table public.player_profiles from public, anon, authenticated;
grant select on table public.player_profiles to authenticated;
grant update (
  skill_band,
  play_intent,
  prefers_singles,
  prefers_doubles,
  bio
) on table public.player_profiles to authenticated;

revoke all on table public.player_zones from public, anon, authenticated;
grant select, insert, update, delete on table public.player_zones to authenticated;

revoke all on table public.zones from public, anon, authenticated;
grant select on table public.zones to authenticated;

revoke all on table public.club_memberships from public, anon, authenticated;
revoke all on table public.platform_roles from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;
