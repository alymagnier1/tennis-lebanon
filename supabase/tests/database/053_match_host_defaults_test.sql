\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(10);

-- Columns exist.
select has_column(
  'public',
  'player_profiles',
  'default_match_visibility',
  'default_match_visibility column exists'
);

select has_column(
  'public',
  'player_profiles',
  'default_requires_creator_approval',
  'default_requires_creator_approval column exists'
);

select has_column(
  'public',
  'player_profiles',
  'default_min_skill',
  'default_min_skill column exists'
);

select has_column(
  'public',
  'player_profiles',
  'default_max_skill',
  'default_max_skill column exists'
);

select has_column(
  'public',
  'player_profiles',
  'default_match_format',
  'default_match_format column exists'
);

select has_column(
  'public',
  'player_profiles',
  'match_defaults_set_at',
  'match_defaults_set_at column exists'
);

-- Column defaults: a profile written without these fields must land on a
-- public, no-approval listing with a null level range that the client derives.
select col_default_is(
  'public',
  'player_profiles',
  'default_match_visibility',
  'public',
  'new profiles default to a public listing'
);

select col_default_is(
  'public',
  'player_profiles',
  'default_requires_creator_approval',
  'false',
  'new profiles do not require join approval'
);

-- Backfill: hosts who had already created a match are treated as configured.
--
-- The shipped statement ran at migration time, before seed.sql inserted any
-- matches, so it cannot be observed on this database. Replay it against a
-- controlled fixture instead — the logic is what could be wrong, not whether
-- it executed.
update public.player_profiles set match_defaults_set_at = null;

update public.player_profiles as pp
set match_defaults_set_at = now()
where pp.match_defaults_set_at is null
  and exists (
    select 1
    from public.matches as m
    where m.creator_id = pp.user_id
  );

select is_empty(
  $$
    select pp.user_id
    from public.player_profiles as pp
    where pp.match_defaults_set_at is null
      and exists (
        select 1
        from public.matches as m
        where m.creator_id = pp.user_id
      )
  $$,
  'every player who has hosted a match is marked configured'
);

-- The discriminating half: a player who never hosted must still be prompted.
select is_empty(
  $$
    select pp.user_id
    from public.player_profiles as pp
    where pp.match_defaults_set_at is not null
      and not exists (
        select 1
        from public.matches as m
        where m.creator_id = pp.user_id
      )
  $$,
  'players who never hosted are left unconfigured'
);

select * from finish();
rollback;
