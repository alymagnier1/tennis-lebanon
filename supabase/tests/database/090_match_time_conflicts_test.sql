\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(4);

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

create or replace function pg_temp.clear_hosted(p_creator uuid)
returns void
language plpgsql
as $$
declare
  v_existing uuid;
begin
  perform pg_temp.set_caller(p_creator);

  for v_existing in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft', 'open', 'full', 'ready_to_book', 'booking_pending')
  loop
    begin
      perform public.cancel_match(v_existing, 'test cleanup');
    exception
      when others then
        null;
    end;
  end loop;
end;
$$;

-- Fixed timing, so `selected_time_option_id` is set at publish and the match
-- has an agreed hour the moment it goes live.
create or replace function pg_temp.match_at(
  p_creator uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_approval boolean default false
)
returns uuid
language plpgsql
as $$
begin
  perform pg_temp.set_caller(p_creator);

  return public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    p_approval,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object('starts_at', p_starts::text, 'ends_at', p_ends::text)
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- An overlapping hour is refused
-- ---------------------------------------------------------------------------

do $$
declare
  v_host_a uuid := '11111111-1111-1111-1111-111111111111';
  v_host_c uuid := '66666666-6666-6666-6666-666666666666';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_base timestamptz := date_trunc('hour', now() + interval '3 days');
  v_first uuid;
  v_clash uuid;
  v_after uuid;
  v_conflicts integer;
begin
  perform pg_temp.clear_hosted(v_host_a);
  perform pg_temp.clear_hosted(v_host_c);

  v_first := pg_temp.match_at(v_host_a, v_base, v_base + interval '90 minutes');

  perform pg_temp.set_caller(v_joiner);
  perform pg_temp.assert_true(
    public.join_match(v_first)::text = 'accepted',
    'the first join should be accepted'
  );

  -- Starts half an hour into the match already committed to.
  v_clash := pg_temp.match_at(
    v_host_c,
    v_base + interval '30 minutes',
    v_base + interval '120 minutes'
  );

  perform pg_temp.set_caller(v_joiner);
  begin
    perform public.join_match(v_clash);
    raise exception 'joining an overlapping match should have been refused';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'match_time_conflict' then
        raise exception 'expected match_time_conflict, got %', sqlerrm;
      end if;
  end;

  -- The wrapper explains what the guard refused.
  perform pg_temp.set_caller(v_joiner);
  select count(*)
  into v_conflicts
  from public.viewer_agreed_time_conflicts(
    v_base + interval '30 minutes',
    v_base + interval '120 minutes',
    v_clash
  );

  perform pg_temp.assert_true(
    v_conflicts = 1,
    'the conflict wrapper should name the match already committed to'
  );

  -- Back to back is not a clash: the ranges are half-open.
  v_after := pg_temp.match_at(
    v_host_c,
    v_base + interval '90 minutes',
    v_base + interval '180 minutes'
  );

  perform pg_temp.set_caller(v_joiner);
  perform pg_temp.assert_true(
    public.join_match(v_after)::text = 'accepted',
    'a match starting exactly when another ends must still be joinable'
  );
end;
$$;

select pass('an overlapping agreed hour is refused');
select pass('the conflict wrapper reports the clash');
select pass('back-to-back matches do not collide');

-- ---------------------------------------------------------------------------
-- A cancelled commitment frees the hour again
-- ---------------------------------------------------------------------------

do $$
declare
  v_host_a uuid := '11111111-1111-1111-1111-111111111111';
  v_host_c uuid := '66666666-6666-6666-6666-666666666666';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_base timestamptz := date_trunc('hour', now() + interval '6 days');
  v_first uuid;
  v_second uuid;
begin
  perform pg_temp.clear_hosted(v_host_a);
  perform pg_temp.clear_hosted(v_host_c);

  v_first := pg_temp.match_at(v_host_a, v_base, v_base + interval '90 minutes');

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_first);

  perform pg_temp.set_caller(v_host_a);
  perform public.cancel_match(v_first, 'freeing the hour');

  v_second := pg_temp.match_at(v_host_c, v_base, v_base + interval '90 minutes');

  perform pg_temp.set_caller(v_joiner);
  perform pg_temp.assert_true(
    public.join_match(v_second)::text = 'accepted',
    'a cancelled match must stop blocking its hour'
  );
end;
$$;

select pass('a cancelled match releases its hour');

select * from finish();

rollback;
