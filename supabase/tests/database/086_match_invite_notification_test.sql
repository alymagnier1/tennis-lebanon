\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(3);

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

create or replace function pg_temp.hosted_match(p_host uuid)
returns uuid
language plpgsql
as $$
declare
  v_old uuid;
begin
  perform pg_temp.set_caller(p_host);
  for v_old in
    select lm.match_id from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft','open','full','ready_to_book','booking_pending','confirmed','in_progress')
  loop
    begin
      perform public.cancel_match(v_old, 'test setup');
    exception when others then null;
    end;
  end loop;

  return public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'beginner'::public.skill_band,
    'competitive'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(jsonb_build_object(
      'starts_at', (now() + interval '3 days')::text,
      'ends_at', (now() + interval '3 days 90 minutes')::text)),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]);
end;
$$;

-- ---------------------------------------------------------------------------
-- The case `044` broke: a targeted invite reaches the person it named
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_guest uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_before integer;
begin
  select count(*) into v_before from public.notifications as n
  where n.user_id = v_guest and n.kind = 'match_invitation';

  v_match := pg_temp.hosted_match(v_host);
  perform public.create_match_invite(v_match, v_guest);

  perform pg_temp.assert_true(
    (select count(*) from public.notifications as n
     where n.user_id = v_guest
       and n.kind = 'match_invitation'
       and n.entity_id = v_match) = 1,
    'an invited player gets exactly one match_invitation'
  );

  -- The deep link is the whole payload now; title and body are localized by
  -- kind in the client and the Edge Function, not carried in the row.
  perform pg_temp.assert_true(
    (select n.payload ->> 'deepLink' from public.notifications as n
     where n.user_id = v_guest and n.entity_id = v_match
       and n.kind = 'match_invitation')
      = format('/match/%s', v_match),
    'the notification deep-links to the match'
  );
end;
$$;

select pass('an invited player gets exactly one match_invitation');
select pass('the notification deep-links to the match');

-- ---------------------------------------------------------------------------
-- A share-link invite names nobody, so there is nobody to notify
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '66666666-6666-6666-6666-666666666666';
  v_match uuid;
  v_count integer;
begin
  v_match := pg_temp.hosted_match(v_host);
  perform public.create_match_invite(v_match, null);

  select count(*) into v_count from public.notifications as n
  where n.kind = 'match_invitation' and n.entity_id = v_match;

  perform pg_temp.assert_true(
    v_count = 0,
    'an untargeted share link notifies nobody'
  );
end;
$$;

select pass('an untargeted share link notifies nobody');

select * from finish();

rollback;
