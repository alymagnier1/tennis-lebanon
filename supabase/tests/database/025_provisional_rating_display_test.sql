\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(2);

set local role postgres;

update public.player_profiles
set
  rated_match_count = 0,
  internal_rating = 1200
where user_id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select result.display_rating
    from public.get_public_player_card('22222222-2222-2222-2222-222222222222') as result
  ),
  null,
  'provisional players hide numeric rating on public cards'
);

set local role postgres;

update public.player_profiles
set
  rated_match_count = 5,
  internal_rating = 1312
where user_id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select result.display_rating
    from public.get_public_player_card('22222222-2222-2222-2222-222222222222') as result
  ),
  1312,
  'established players expose earned rating on public cards'
);

rollback;
