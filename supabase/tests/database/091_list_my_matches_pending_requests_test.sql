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

create or replace function pg_temp.approval_match(p_creator uuid)
returns uuid
language plpgsql
as $$
declare
  v_existing uuid;
begin
  perform pg_temp.set_caller(p_creator);

  for v_existing in
    select lm.match_id from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft','open','full','ready_to_book','booking_pending')
  loop
    begin perform public.cancel_match(v_existing, 'test cleanup'); exception when others then null; end;
  end loop;

  return public.create_and_publish_match(
    'doubles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'competitive'::public.skill_band,
    true,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (date_trunc('hour', now()) + interval '200 days')::text,
        'ends_at', (date_trunc('hour', now()) + interval '200 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );
end;
$$;

create or replace function pg_temp.pending_for(p_user_id uuid, p_match_id uuid)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  perform pg_temp.set_caller(p_user_id);
  select lm.pending_request_count into v_count
  from public.list_my_matches() as lm
  where lm.match_id = p_match_id;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- The host is counted a decision they can act on; nobody else is
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_asker uuid := '22222222-2222-2222-2222-222222222222';
  v_other uuid := '88888888-8888-8888-8888-888888888888';
  v_match uuid;
begin
  v_match := pg_temp.approval_match(v_host);

  perform pg_temp.assert_true(
    pg_temp.pending_for(v_host, v_match) = 0,
    'a match nobody has asked to join should count zero'
  );

  perform pg_temp.set_caller(v_asker);
  perform public.join_match(v_match);

  perform pg_temp.assert_true(
    pg_temp.pending_for(v_host, v_match) = 1,
    'the host should be counted the waiting request'
  );

  -- Another accepted participant can neither accept nor decline, so the
  -- 2026-08-21 rule applies: they are not shown a decision that is not theirs.
  perform pg_temp.set_caller(v_other);
  perform public.join_match(v_match);
  perform pg_temp.set_caller(v_host);
  perform public.respond_to_join_request(v_match, v_other, true);

  perform pg_temp.assert_true(
    coalesce(pg_temp.pending_for(v_other, v_match), -1) = 0,
    'a non-creator must be counted zero, whatever is actually pending'
  );
end;
$$;

select pass('no requests counts zero');
select pass('the host is counted a waiting request');
select pass('a non-creator is never counted one');

select * from finish();

rollback;
