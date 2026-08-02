-- 042 shipped setting and replacing an avatar but no way back to the initials
-- placeholder: a null path hit the ownership regex and raised
-- avatar_path_forbidden, so a player who regretted a photo could only swap it
-- for another one.
--
-- Null now means "clear it". The ownership and existence checks only apply to a
-- path that is actually being set, and the old path still comes back so the
-- caller removes the object through the Storage API, exactly as replacement
-- already does.

-- `default null` so clearing is "call it with nothing" rather than "pass a null
-- text". It also makes the generated client type optional instead of a plain
-- string, which is what lets the caller express a clear without a cast.
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
  v_user_id := public.assert_marketplace_caller();

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
