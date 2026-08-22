-- Self-description during onboarding: an optional gender, and an avatar that
-- can actually be set before onboarding finishes.
--
-- Two separate things, one shared cause.
--
-- 1. `profiles` had no gender column at all. Added as a nullable enum, written
--    only through `set_own_gender`, with direct column UPDATE revoked the same
--    way `003` did for `skill_band` and `042` for `avatar_path`. Nullable is the
--    "prefer not to say" answer -- storing a sentinel for a non-answer would
--    make an absent value indistinguishable from a declined one.
--
-- 2. `set_own_avatar` guarded on `assert_marketplace_caller`, which requires
--    `onboarding_completed_at is not null`. That made the avatar unsettable
--    from inside onboarding -- the exact place a player is being asked to
--    describe themselves -- failing with "Caller is not marketplace-eligible".
--
--    Regraded to `assert_authenticated_caller`, which still demands a real
--    session and an account that is neither deleted nor pending deletion. The
--    operation is entirely self-scoped and its authorization does not rest on
--    this guard: `is_own_avatar_storage_path` pins the path to the caller's own
--    folder, the storage policies from `042` independently restrict writes to
--    that folder, and the update targets `where id = v_user_id`. Marketplace
--    eligibility gates taking part in matches, not describing yourself.
--    `020_push_tokens.sql` already draws the line in the same place.

do $$
begin
  create type public.gender as enum ('woman', 'man', 'other');
exception
  when duplicate_object then null;
end;
$$;

alter table public.profiles
  add column if not exists gender public.gender;

comment on column public.profiles.gender is
  'Optional self-declared gender. Null means not stated. Display only: no discovery filter reads it.';

revoke update (gender) on table public.profiles from authenticated;

create or replace function public.set_own_gender(
  p_gender public.gender default null
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
  -- Deliberately not the marketplace guard: this is set during onboarding,
  -- before `onboarding_completed_at` exists.
  v_user_id := public.assert_authenticated_caller();

  update public.profiles
  set gender = p_gender
  where id = v_user_id;
end;
$$;

revoke all on function public.set_own_gender(public.gender) from public, anon;
grant execute on function public.set_own_gender(public.gender) to authenticated;

-- Body is `043`'s verbatim -- including the null-clears-the-avatar path and the
-- `is distinct from` that keeps the clear returning the old object -- with only
-- the guard on the first line changed. Rebuilding it from `042` instead would
-- silently revert `043`.
create or replace function public.set_own_avatar(p_avatar_path text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_old_path text;
begin
  v_user_id := public.assert_authenticated_caller();

  if p_avatar_path is not null then
    if not public.is_own_avatar_storage_path(v_user_id, p_avatar_path) then
      raise exception using
        errcode = '42501',
        message = 'avatar_path_forbidden';
    end if;

    if not exists (
      select 1
      from storage.objects as o
      where o.bucket_id = 'avatars'
        and o.name = p_avatar_path
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'avatar_object_missing';
    end if;
  end if;

  select p.avatar_path
  into v_old_path
  from public.profiles as p
  where p.id = v_user_id
  for update;

  update public.profiles
  set avatar_path = p_avatar_path
  where id = v_user_id;

  -- `is distinct from` rather than `<>`: comparing against a null p_avatar_path
  -- yields null, which would swallow the return on the clear path.
  if v_old_path is not null
     and v_old_path is distinct from p_avatar_path
     and public.is_own_avatar_storage_path(v_user_id, v_old_path) then
    return v_old_path;
  end if;

  return null;
end;
$$;

revoke all on function public.set_own_avatar(text) from public, anon;
grant execute on function public.set_own_avatar(text) to authenticated;
