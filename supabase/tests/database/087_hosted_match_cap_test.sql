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

create or replace function pg_temp.clear_hosted(p_user uuid)
returns void
language plpgsql
as $$
declare
  v_old uuid;
begin
  perform pg_temp.set_caller(p_user);
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
end;
$$;

create or replace function pg_temp.draft(
  p_format public.match_format,
  p_visibility public.match_visibility,
  p_days integer
)
returns uuid
language plpgsql
as $$
begin
  return public.create_match_draft(
    p_format,
    p_visibility,
    'social'::public.play_intent,
    'beginner'::public.skill_band,
    'competitive'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(jsonb_build_object(
      'starts_at', (now() + (p_days || ' days')::interval)::text,
      'ends_at', (now() + (p_days || ' days')::interval + interval '90 minutes')::text)),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]);
end;
$$;

-- ---------------------------------------------------------------------------
-- Three of anything, then no more
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_first uuid;
  v_second uuid;
  v_third uuid;
  v_blocked boolean := false;
begin
  perform pg_temp.clear_hosted(v_host);

  -- A deliberate mix: the old rules would have refused the second (same format,
  -- public) and never counted across formats at all.
  v_first := pg_temp.draft('singles', 'public', 3);
  perform public.publish_match(v_first);
  v_second := pg_temp.draft('singles', 'invite_only', 4);
  perform public.publish_match(v_second);
  v_third := pg_temp.draft('doubles', 'public', 5);

  perform pg_temp.assert_true(
    (select count(*) from public.matches as m
     where m.creator_id = v_host
       and m.status in ('draft','open','full','ready_to_book')) = 3,
    'three matches of any mix are allowed'
  );

  -- The third is still a draft, and drafts occupy a slot.
  begin
    perform pg_temp.draft('singles', 'invite_only', 6);
  exception when others then
    v_blocked := sqlerrm = 'match_cap_reached';
  end;

  perform pg_temp.assert_true(v_blocked, 'the fourth is refused');

  -- Publishing the draft does not change the count, so it must not be refused.
  perform public.publish_match(v_third);

  perform pg_temp.assert_true(
    (select m.status from public.matches as m where m.id = v_third) = 'open',
    'publishing a counted draft is never blocked'
  );

  -- Cancelling frees exactly one slot.
  perform public.cancel_match(v_second, 'making room');

  perform pg_temp.assert_true(
    pg_temp.draft('singles', 'public', 7) is not null,
    'cancelling one frees a slot'
  );
end;
$$;

select pass('three matches of any mix are allowed');
select pass('the fourth is refused');
select pass('publishing a counted draft is never blocked');
select pass('cancelling one frees a slot');

-- ---------------------------------------------------------------------------
-- The cap is per host, not global
-- ---------------------------------------------------------------------------

do $$
declare
  v_other uuid := '66666666-6666-6666-6666-666666666666';
begin
  -- Player A is at the cap from the block above; this must not affect anyone.
  perform pg_temp.clear_hosted(v_other);

  perform pg_temp.assert_true(
    pg_temp.draft('singles', 'public', 3) is not null,
    'another host is unaffected by someone else being at the cap'
  );
end;
$$;

select pass('another host is unaffected by someone else being at the cap');

select * from finish();

rollback;
