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

-- ---------------------------------------------------------------------------
-- The grants a player needs to describe themselves
-- ---------------------------------------------------------------------------

select is(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'),
  true,
  'a player can rename themselves'
);

select is(
  has_column_privilege('authenticated', 'public.profiles', 'languages', 'UPDATE'),
  true,
  'a player can change the languages they speak'
);

select is(
  has_column_privilege('authenticated', 'public.player_profiles', 'bio', 'UPDATE'),
  true,
  'a player can write their own bio'
);

-- ---------------------------------------------------------------------------
-- And the ones they must not have. Granting per column rather than table-wide
-- is the whole point: `042` moved avatars behind `set_own_avatar` and `079`
-- did the same for gender, and neither should have come back with this.
-- ---------------------------------------------------------------------------

select is(
  has_column_privilege('authenticated', 'public.profiles', 'avatar_path', 'UPDATE'),
  false,
  'avatar_path stays behind set_own_avatar'
);

select is(
  has_column_privilege('authenticated', 'public.profiles', 'account_status', 'UPDATE'),
  false,
  'a player cannot change their own account status'
);

-- ---------------------------------------------------------------------------
-- Languages are constrained, because a grant without one lets a caller reaching
-- past the app store a code every reader would then have to defend against.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_rejected integer := 0;
begin
  begin
    update public.profiles set languages = array['klingon'] where id = v_user;
  exception when check_violation then
    v_rejected := v_rejected + 1;
  end;

  begin
    update public.profiles set languages = array[]::text[] where id = v_user;
  exception when check_violation then
    v_rejected := v_rejected + 1;
  end;

  perform pg_temp.assert_true(
    v_rejected = 2,
    format('both an unsupported code and an empty list should be refused, got %s', v_rejected)
  );

  -- A supported set still goes through.
  update public.profiles set languages = array['en', 'fr'] where id = v_user;
end;
$$;

select pass('unsupported and empty language lists are refused');

select * from finish();

rollback;
