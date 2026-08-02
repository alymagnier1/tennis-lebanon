\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

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

set local role authenticated;

-- ---------------------------------------------------------------------------
-- 20 invitations per user per day (docs/TESTING_SECURITY.md:71).
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_match_id uuid;
  v_message text := '';
  v_sent integer := 0;
  v_starts timestamptz := now() + interval '10 days';
begin
  perform pg_temp.set_caller(v_creator);

  v_match_id := public.create_and_publish_match(
    'doubles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', v_starts::text,
        'ends_at', (v_starts + interval '90 minutes')::text
      )
    ),
    'fixed',
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  -- Link invites carry no target, so they can be issued repeatedly without
  -- needing twenty real players to aim at.
  for v_sent in 1..20 loop
    perform public.create_match_invite(v_match_id, null);
  end loop;

  begin
    perform public.create_match_invite(v_match_id, null);
  exception
    when others then
      v_message := sqlerrm;
  end;

  perform pg_temp.assert_true(
    v_message like '%invite_rate_limited%',
    format('the 21st invite in a day should be refused, got: %s', v_message)
  );

  -- The ceiling is per user, so someone else is unaffected by it.
  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  perform public.join_match(v_match_id);
  perform public.create_match_invite(v_match_id, null);
end;
$$;

select ok(true, 'a player is capped at twenty invites a day, and only their own');

select * from finish();

rollback;
