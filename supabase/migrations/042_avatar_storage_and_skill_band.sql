-- Player profile: private avatar storage + provisional skill band self-service.

revoke update (avatar_path) on table public.profiles from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  524288,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_own_avatar_storage_path(
  p_user_id uuid,
  p_avatar_path text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_avatar_path is not null
    and p_avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    and split_part(p_avatar_path, '/', 1) = p_user_id::text;
$$;

-- Returns the path this replaces, if any, so the caller can remove the old
-- object through the Storage API.
--
-- Deleting it here is not an option: storage.protect_delete() rejects direct
-- deletes from storage.objects, and rightly so -- the row is only half the
-- object, and dropping it would strand the actual file in the storage backend.
-- Doing it in SQL made every replacement fail, so only a player's first ever
-- avatar could be set.
drop function if exists public.set_own_avatar(text);

create function public.set_own_avatar(p_avatar_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_old_path text;
begin
  v_user_id := public.assert_marketplace_caller();

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

  select p.avatar_path
  into v_old_path
  from public.profiles as p
  where p.id = v_user_id
  for update;

  update public.profiles
  set avatar_path = p_avatar_path
  where id = v_user_id;

  if v_old_path is not null
     and v_old_path <> p_avatar_path
     and public.is_own_avatar_storage_path(v_user_id, v_old_path) then
    return v_old_path;
  end if;

  return null;
end;
$$;

revoke all on function public.set_own_avatar(text) from public;
grant execute on function public.set_own_avatar(text) to authenticated;

create or replace function public.set_own_skill_band(p_skill_band public.skill_band)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_rated_count integer;
begin
  v_user_id := public.assert_marketplace_caller();

  select pp.rated_match_count
  into v_rated_count
  from public.player_profiles as pp
  where pp.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Player profile not found';
  end if;

  if v_rated_count >= 5 then
    raise exception using errcode = 'P0001', message = 'skill_band_locked';
  end if;

  update public.player_profiles
  set skill_band = p_skill_band
  where user_id = v_user_id;
end;
$$;

revoke all on function public.set_own_skill_band(public.skill_band) from public;
grant execute on function public.set_own_skill_band(public.skill_band) to authenticated;

-- Storage RLS: folder-per-user under avatars bucket.
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_select_authenticated on storage.objects;
create policy avatars_select_authenticated
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');
