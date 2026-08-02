\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(6);

create or replace function pg_temp.assert_true(
  p_condition boolean,
  p_description text
)
returns void
language plpgsql
as $$
begin
  if not p_condition then
    raise exception '%', p_description;
  end if;
end;
$$;

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

set local role authenticated;

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_foreign_path text := v_user_b::text || '/intruder.jpg';
  v_own_path text := v_user_a::text || '/avatar.jpg';
begin
  perform pg_temp.set_caller(v_user_a);

  begin
    perform public.set_own_avatar(v_foreign_path);
    raise exception 'set_own_avatar should reject another user folder';
  exception
    when others then
      perform pg_temp.assert_true(
        sqlerrm like '%avatar_path_forbidden%',
        'foreign avatar path should be forbidden'
      );
  end;

  begin
    insert into storage.objects (bucket_id, name, owner, metadata)
    values ('avatars', v_foreign_path, v_user_a, '{}'::jsonb);
    raise exception 'storage insert into foreign folder should fail';
  exception
    when others then
      perform pg_temp.assert_true(
        sqlstate = '42501',
        'storage RLS should block foreign-folder upload'
      );
  end;

  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('avatars', v_own_path, v_user_a, '{}'::jsonb);

  perform public.set_own_avatar(v_own_path);

  perform pg_temp.assert_true(
    (select avatar_path from public.profiles where id = v_user_a) = v_own_path,
    'set_own_avatar should persist the path on the profile'
  );
end;
$$;

select ok(true, 'set_own_avatar rejects foreign paths and accepts own uploads');

-- ---------------------------------------------------------------------------
-- Replacing an avatar must work at all, hand back the path it replaced, and
-- never point the profile at an object that was not uploaded.
--
-- Regression: deleting the old object in SQL tripped storage.protect_delete(),
-- so every replacement failed and a player could only ever set a first avatar.
-- Cleanup belongs to the caller via the Storage API, which is why the previous
-- path comes back instead.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_old_path text := v_user_a::text || '/avatar.jpg';
  v_new_path text := v_user_a::text || '/avatar-2.jpg';
  v_ghost_path text := v_user_a::text || '/never-uploaded.jpg';
  v_replaced text;
begin
  perform pg_temp.set_caller(v_user_a);

  -- Claiming a path that was never uploaded would leave every viewer with a
  -- broken image and no way to tell why.
  begin
    perform public.set_own_avatar(v_ghost_path);
    raise exception 'set_own_avatar accepted a path with no object behind it';
  exception
    when others then
      perform pg_temp.assert_true(
        sqlerrm like '%avatar_object_missing%',
        format('expected avatar_object_missing, got: %s', sqlerrm)
      );
  end;

  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('avatars', v_new_path, v_user_a, '{}'::jsonb);

  v_replaced := public.set_own_avatar(v_new_path);

  perform pg_temp.assert_true(
    v_replaced = v_old_path,
    format('expected the replaced path back, got: %s', coalesce(v_replaced, 'null'))
  );

  perform pg_temp.assert_true(
    (select avatar_path from public.profiles where id = v_user_a) = v_new_path,
    'the profile should point at the replacement'
  );
end;
$$;

select ok(true, 'replacing an avatar succeeds and reports the path it replaced');

-- ---------------------------------------------------------------------------
-- Clearing: a null path is "remove my photo", not a malformed one.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_current text := v_user_a::text || '/avatar-2.jpg';
  v_replaced text;
begin
  perform pg_temp.set_caller(v_user_a);

  v_replaced := public.set_own_avatar(null);

  perform pg_temp.assert_true(
    v_replaced = v_current,
    format('clearing should report the removed path, got: %s', coalesce(v_replaced, 'null'))
  );

  perform pg_temp.assert_true(
    (select avatar_path from public.profiles where id = v_user_a) is null,
    'clearing should leave the profile with no avatar'
  );

  -- Clearing again is a no-op rather than an error, so a double tap or a retry
  -- after a failed object delete cannot wedge the player.
  perform pg_temp.assert_true(
    public.set_own_avatar(null) is null,
    'clearing an already-empty avatar should report nothing to remove'
  );
end;
$$;

select ok(true, 'a null path clears the avatar and reports what to delete');

-- ---------------------------------------------------------------------------
-- Other players must be able to read the object, or every discover card and
-- match roster falls back to initials for good.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_path text := v_user_a::text || '/avatar-2.jpg';
begin
  perform pg_temp.set_caller(v_user_b);

  perform pg_temp.assert_true(
    exists (
      select 1
      from storage.objects as o
      where o.bucket_id = 'avatars'
        and o.name = v_path
    ),
    'a signed-in player should be able to read another player avatar object'
  );

  -- Readable is not writable: the folder policies still have to hold.
  begin
    delete from storage.objects as o
    where o.bucket_id = 'avatars'
      and o.name = v_path;

    perform pg_temp.assert_true(
      exists (
        select 1
        from storage.objects as o
        where o.bucket_id = 'avatars'
          and o.name = v_path
      ),
      'another player must not be able to delete someone else avatar'
    );
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

select ok(true, 'avatars are readable by other players but writable only by their owner');

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform set_config('role', 'postgres', true);
  update public.player_profiles
  set rated_match_count = 0
  where user_id = v_user_a;
  perform set_config('role', 'authenticated', true);
  perform pg_temp.set_caller(v_user_a);

  perform public.set_own_skill_band('intermediate'::public.skill_band);

  perform pg_temp.assert_true(
    (select skill_band from public.player_profiles where user_id = v_user_a) =
      'intermediate'::public.skill_band,
    'provisional player should be able to change skill band'
  );
end;
$$;

select ok(true, 'set_own_skill_band works while provisional');

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform set_config('role', 'postgres', true);
  update public.player_profiles
  set rated_match_count = 5
  where user_id = v_user_a;
  perform set_config('role', 'authenticated', true);
  perform pg_temp.set_caller(v_user_a);

  begin
    perform public.set_own_skill_band('advanced'::public.skill_band);
    raise exception 'locked skill band should not update';
  exception
    when others then
      perform pg_temp.assert_true(
        sqlerrm like '%skill_band_locked%',
        'established players should be locked out of self-editing skill band'
      );
  end;
end;
$$;

select ok(true, 'set_own_skill_band refuses established players');

select * from finish();
rollback;
