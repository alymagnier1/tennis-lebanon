\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(5);

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
-- It answers for the caller's own account, both ways
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '14141414-1414-1414-1414-141414141414';
  v_other uuid := '13131313-1313-1313-1313-131313131313';
begin
  perform pg_temp.set_caller(v_user);

  update auth.users set encrypted_password = null where id = v_user;
  perform pg_temp.assert_true(
    public.caller_has_password() = false,
    'a Google-only account should report no password'
  );

  update auth.users set encrypted_password = 'hashed' where id = v_user;
  perform pg_temp.assert_true(
    public.caller_has_password() = true,
    'an account with a password should say so'
  );

  -- Supabase has been seen to store an empty string rather than null on some
  -- paths, and an empty hash is not a password anyone can sign in with.
  update auth.users set encrypted_password = '' where id = v_user;
  perform pg_temp.assert_true(
    public.caller_has_password() = false,
    'an empty hash is not a password'
  );

  -- The answer is about the caller, not about whoever else holds one. If this
  -- read any row but `auth.uid()`, the function would become a way to probe
  -- other accounts.
  update auth.users set encrypted_password = 'hashed' where id = v_other;
  perform pg_temp.assert_true(
    public.caller_has_password() = false,
    'another account holding a password must not change the answer'
  );
end;
$$;

select ok(true, 'caller_has_password answers only for the caller');

-- ---------------------------------------------------------------------------
-- Not reachable before sign-in
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.caller_has_password()', 'execute'),
  'anon cannot call it'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.caller_has_password()', 'execute'
  ),
  'a signed-in caller can'
);

-- With no caller at all it must not error, and must not claim a password.
select set_config('request.jwt.claim.sub', '', false);
select is(
  public.caller_has_password(),
  false,
  'no session means no password, rather than a failure'
);

select is(
  (select count(*)::int from pg_proc where proname = 'caller_has_password'),
  1,
  'exactly one definition'
);

select * from finish();

rollback;
