\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(7);

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
-- Gender is settable from inside onboarding, which is the only place it is asked
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_stored public.gender;
begin
  -- Put the player back mid-onboarding: this is the state the marketplace
  -- guard refuses, and the reason `set_own_gender` uses the weaker one.
  update public.profiles set onboarding_completed_at = null where id = v_user;

  perform pg_temp.set_caller(v_user);
  perform public.set_own_gender('woman');

  select p.gender into v_stored from public.profiles as p where p.id = v_user;
  perform pg_temp.assert_true(
    v_stored = 'woman',
    'a player still in onboarding should be able to state their gender'
  );

  -- Null is the "prefer not to say" answer rather than a stored sentinel, so
  -- declining has to be reachable after answering.
  perform public.set_own_gender(null);

  select p.gender into v_stored from public.profiles as p where p.id = v_user;
  perform pg_temp.assert_true(
    v_stored is null,
    'clearing gender should return it to not stated'
  );
end;
$$;

select pass('gender can be set during onboarding');
select pass('gender can be cleared back to not stated');

-- ---------------------------------------------------------------------------
-- The avatar guard was regraded, not removed
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_message text;
begin
  update public.profiles set onboarding_completed_at = null where id = v_user;
  perform pg_temp.set_caller(v_user);

  -- A path belonging to somebody else must still be refused, and the refusal
  -- must come from the ownership check rather than from eligibility -- that is
  -- what proves the marketplace guard is gone but the real one is not.
  begin
    perform public.set_own_avatar(
      '22222222-2222-2222-2222-222222222222/avatar.jpg'
    );
    raise exception 'expected set_own_avatar to refuse a foreign path';
  exception
    when sqlstate '42501' then
      get stacked diagnostics v_message = message_text;
      perform pg_temp.assert_true(
        v_message = 'avatar_path_forbidden',
        'refusal should be the ownership check, got: ' || v_message
      );
  end;
end;
$$;

select pass('a mid-onboarding caller reaches the avatar ownership check');
select pass('another players avatar path is still refused');

-- ---------------------------------------------------------------------------
-- Column and grants
-- ---------------------------------------------------------------------------

select is(
  has_column_privilege('authenticated', 'public.profiles', 'gender', 'UPDATE'),
  false,
  'gender must only be writable through set_own_gender'
);

select is(
  has_function_privilege('anon', 'public.set_own_gender(public.gender)', 'EXECUTE'),
  false,
  'anonymous callers cannot set a gender'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.set_own_gender(public.gender)',
    'EXECUTE'
  ),
  true,
  'signed-in players can set their own gender'
);

select * from finish();

rollback;
