\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(9);

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

-- ---------------------------------------------------------------------------
-- The identity is released, so the address can be used again
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '14141414-1414-1414-1414-141414141414';
  v_email text;
begin
  select u.email into v_email from auth.users as u where u.id = v_user;
  perform pg_temp.assert_true(
    v_email = 'player-j@tennis-lebanon.test',
    'precondition: the seeded address is attached'
  );

  perform pg_temp.set_caller(v_user);
  perform public.request_account_deletion();

  -- The whole point: re-registering with the same address must stop being
  -- refused as "already in use".
  perform pg_temp.assert_true(
    not exists (
      select 1 from auth.users as u
      where lower(u.email) = 'player-j@tennis-lebanon.test'
    ),
    'the address must be free for a new sign-up'
  );

  perform pg_temp.assert_true(
    not exists (select 1 from auth.identities as i where i.user_id = v_user),
    'identities must be removed so nothing can sign in as the old account'
  );
  perform pg_temp.assert_true(
    (select u.encrypted_password is null from auth.users as u where u.id = v_user),
    'the credential must be gone'
  );
end;
$$;

select pass('the address is released for re-use');
select pass('sign-in identities are removed');
select pass('the credential is removed');

-- ---------------------------------------------------------------------------
-- The person is anonymised, the record is not destroyed
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '13131313-1313-1313-1313-131313131313';
begin
  perform pg_temp.set_caller(v_user);
  perform public.request_account_deletion();

  perform pg_temp.assert_true(
    (select p.display_name = 'Deleted player'
       and p.avatar_path is null
       and p.birth_year is null
       and p.account_status = 'deleted'
     from public.profiles as p where p.id = v_user),
    'the profile should become an anonymous tombstone'
  );

  -- The row itself must survive: eight tables cascade from it, including
  -- match_participants. Losing it would gut other players' history.
  perform pg_temp.assert_true(
    exists (select 1 from public.profiles as p where p.id = v_user),
    'the profile row must survive so foreign keys still resolve'
  );

  perform pg_temp.assert_true(
    not exists (select 1 from public.player_zones as z where z.user_id = v_user)
    and not exists (select 1 from public.availability_windows as a where a.user_id = v_user),
    'where and when they play should be gone'
  );
end;
$$;

select pass('the profile becomes an anonymous tombstone');
select pass('the profile row survives for referential integrity');
select pass('discovery data is cleared');

-- ---------------------------------------------------------------------------
-- Other players keep their matches
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_leaver uuid := '88888888-8888-8888-8888-888888888888';
  v_match uuid;
  v_before integer;
begin
  perform pg_temp.set_caller(v_host);
  v_match := public.create_and_publish_match(
    'doubles', 'public', 'social', 'beginner', 'competitive', false, null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(jsonb_build_object(
      'starts_at', (date_trunc('hour', now()) + interval '200 days')::text,
      'ends_at', (date_trunc('hour', now()) + interval '200 days 90 minutes')::text)),
    'fixed', array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]);

  perform pg_temp.set_caller(v_leaver);
  perform public.join_match(v_match, null);

  select public.match_participant_count(v_match) into v_before;
  perform pg_temp.assert_true(v_before = 2, 'precondition: two on the roster');

  perform public.request_account_deletion();

  -- The match survives and is recruiting again, rather than holding a seat for
  -- somebody who no longer exists.
  perform pg_temp.assert_true(
    exists (select 1 from public.matches as m
            where m.id = v_match and m.status = 'open'),
    'the match must survive and reopen the seat'
  );
  perform pg_temp.assert_true(
    public.match_participant_count(v_match) = 1,
    'the departing player should leave the roster'
  );
  perform pg_temp.assert_true(
    exists (select 1 from public.match_participants as mp
            where mp.match_id = v_match and mp.user_id = v_leaver),
    'their participation row stays, so the history is not rewritten'
  );
end;
$$;

select pass('a match the leaver joined survives and reopens');
select pass('the leaver is off the roster');
select pass('the participation record is kept');

select * from finish();

rollback;
