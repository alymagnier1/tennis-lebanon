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

do $$
declare
  v_a uuid := '11111111-1111-1111-1111-111111111111';
  v_b uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_old uuid;
  v_marked timestamptz;
begin
  perform pg_temp.set_caller(v_a);

  for v_old in
    select lm.match_id from public.list_my_matches() as lm
    where lm.is_creator
      and lm.status in ('draft','open','full','ready_to_book','booking_pending','confirmed','in_progress')
  loop
    begin
      perform public.cancel_match(v_old, 'test cleanup');
    exception when others then null;
    end;
  end loop;

  v_match := public.create_and_publish_match(
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

  perform pg_temp.set_caller(v_b);
  perform public.join_match(v_match);

  -- Never opened is null rather than an epoch, so "everything is unread" is
  -- expressible without inventing a sentinel date.
  perform pg_temp.set_caller(v_a);
  perform pg_temp.assert_true(
    public.get_own_chat_last_read(v_match) is null,
    'a thread nobody has opened should read back as null'
  );

  v_marked := public.mark_match_chat_read(v_match);
  perform pg_temp.assert_true(
    v_marked is not null
      and public.get_own_chat_last_read(v_match) = v_marked,
    'marking read should store and return the same moment'
  );

  -- Per participant: A catching up says nothing about B.
  perform pg_temp.set_caller(v_b);
  perform pg_temp.assert_true(
    public.get_own_chat_last_read(v_match) is null,
    'one player reading must not mark the thread read for the other'
  );
end;
$$;

select pass('an unopened thread reads back as null');
select pass('marking read stores the moment it happened');
select pass('read state is per participant');

select is(
  has_function_privilege('anon', 'public.mark_match_chat_read(uuid)', 'EXECUTE'),
  false,
  'anonymous callers cannot mark a chat read'
);

select * from finish();

rollback;
