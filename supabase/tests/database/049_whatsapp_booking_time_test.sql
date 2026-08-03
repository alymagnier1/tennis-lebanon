\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(2);

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

-- ---------------------------------------------------------------------------
-- The hour a club reads is the hour the players meant
--
-- This message is the only thing the app sends a club, so a wrong number here
-- books the wrong court with nothing downstream to catch it.
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_whatsapp_club uuid := 'bbbbbbbb-0001-0001-0001-000000000002';
  -- 18:00 Beirut, deliberately an hour whose UTC rendering differs.
  v_starts timestamptz := (date_trunc('day', now() + interval '4 days')
    at time zone 'Asia/Beirut' + interval '18 hours') at time zone 'Asia/Beirut';
  v_match uuid;
  v_message text;
  v_beirut text;
  v_utc text;
begin
  perform pg_temp.clear_hosted(v_creator);

  v_match := public.create_and_publish_match(
    'singles'::public.match_format,
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
    array[v_whatsapp_club]::uuid[]
  );

  perform pg_temp.set_caller(v_joiner);
  perform public.join_match(v_match);
  perform pg_temp.set_caller(v_creator);

  v_message := public.get_club_whatsapp_booking_link(v_whatsapp_club, v_match) ->> 'message';

  v_beirut := to_char(v_starts at time zone 'Asia/Beirut', 'HH24:MI');
  v_utc := to_char(v_starts at time zone 'UTC', 'HH24:MI');

  perform pg_temp.assert_true(
    v_beirut <> v_utc,
    'the fixture must use an hour where Beirut and UTC differ, or it proves nothing'
  );

  perform pg_temp.assert_true(
    v_message like '%' || v_beirut || '%',
    format('the club must be told the Beirut hour %s, got: %s', v_beirut, v_message)
  );

  perform pg_temp.assert_true(
    v_message not like '%' || v_utc || '%',
    format('the club must not be told the UTC hour %s, got: %s', v_utc, v_message)
  );

  perform pg_temp.assert_true(
    v_message not like '%UTC%',
    format('the message must not label a timezone at all, got: %s', v_message)
  );

  -- The original template hung the newline off the optional time block, so the
  -- next line ran straight on: "19:30Players: 2".
  perform pg_temp.assert_true(
    v_message like E'%\nPlayers: %',
    format('each line needs its own break, got: %s', v_message)
  );
end;
$$;

select pass('the whatsapp message quotes the Beirut hour, not UTC');

-- ---------------------------------------------------------------------------
-- Without a match there is no time to quote, and nothing should break
-- ---------------------------------------------------------------------------

do $$
declare
  v_whatsapp_club uuid := 'bbbbbbbb-0001-0001-0001-000000000002';
  v_message text;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  v_message := public.get_club_whatsapp_booking_link(v_whatsapp_club) ->> 'message';

  perform pg_temp.assert_true(
    v_message like 'Hello, I would like to book a court at WhatsApp Tennis Club%'
      and v_message not like '%Preferred time%',
    format('a club-only link should carry no time, got: %s', v_message)
  );
end;
$$;

select pass('a club link with no match carries no time');

select * from finish();

rollback;
