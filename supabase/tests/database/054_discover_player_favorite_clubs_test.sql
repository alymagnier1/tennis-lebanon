\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(2);

select has_function(
  'public',
  'list_player_favorite_clubs_json',
  array['uuid'],
  'favorite clubs json helper exists'
);

insert into public.player_favorite_clubs (user_id, club_id)
values (
  '22222222-2222-2222-2222-222222222222',
  'bbbbbbbb-0001-0001-0001-000000000001'
)
on conflict do nothing;

-- Asserts the inserted club is present rather than that it is the only one. The
-- player may already have favourites from other fixtures or from manual use of a
-- long-lived dev database, and a total-length assertion turns that into a failure
-- about nothing.
select ok(
  public.list_player_favorite_clubs_json(
    '22222222-2222-2222-2222-222222222222'
  ) @> jsonb_build_array(
    jsonb_build_object('club_id', 'bbbbbbbb-0001-0001-0001-000000000001')
  ),
  'favorite clubs json returns seeded club'
);

select * from finish();
rollback;
