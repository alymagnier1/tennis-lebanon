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

-- An ordinary open match: no approval gate, so the joiner lands as `accepted`
-- and the roster is full at two. `cancel_match` demands a reason once a match
-- is full, which is the case this migration exists for.
create or replace function pg_temp.full_match(p_creator uuid, p_joiner uuid)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
begin
  perform pg_temp.clear_hosted(p_creator);
  perform pg_temp.set_caller(p_creator);

  v_match_id := public.create_and_publish_match(
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
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  perform pg_temp.set_caller(p_joiner);
  perform public.join_match(v_match_id);

  return v_match_id;
end;
$$;

create or replace function pg_temp.notification_count(
  p_user_id uuid,
  p_kind text,
  p_match_id uuid
)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.notifications as n
  where n.user_id = p_user_id
    and n.kind = p_kind
    and n.entity_id = p_match_id;
$$;

create or replace function pg_temp.total_cancelled(p_match_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.notifications as n
  where n.kind = 'match_cancelled'
    and n.entity_id = p_match_id;
$$;

-- ---------------------------------------------------------------------------
-- Cancelling reaches the other player, and not the person who cancelled
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.full_match(v_creator, v_joiner);

  perform pg_temp.assert_true(
    pg_temp.total_cancelled(v_match) = 0,
    'a live match must not carry a cancellation notification'
  );

  perform pg_temp.set_caller(v_creator);
  perform public.cancel_match(v_match, 'double booked the court');

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_joiner, 'match_cancelled', v_match) = 1,
    'the other player should be told the match was cancelled'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_cancelled', v_match) = 0,
    'the person who cancelled should not be told about their own action'
  );

  perform pg_temp.assert_true(
    pg_temp.total_cancelled(v_match) = 1,
    'exactly one player was left to tell'
  );
end;
$$;

select pass('cancelling notifies the other participant');
select pass('cancelling does not notify the canceller');

-- ---------------------------------------------------------------------------
-- Only the transition into `cancelled` fires
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
begin
  v_match := pg_temp.full_match(v_creator, v_joiner);

  -- An unrelated write to the row. The trigger is `after update` on every
  -- column, so this is what stops it firing on notes, times or a booking.
  update public.matches
  set notes = 'bring a spare grip'
  where id = v_match;

  perform pg_temp.assert_true(
    pg_temp.total_cancelled(v_match) = 0,
    'an ordinary update must not enqueue a cancellation'
  );

  perform pg_temp.set_caller(v_creator);
  perform public.cancel_match(v_match, 'rain');

  -- Already cancelled; writing the same status again is not new news.
  update public.matches
  set updated_at = now()
  where id = v_match;

  perform pg_temp.assert_true(
    pg_temp.total_cancelled(v_match) = 1,
    'touching an already-cancelled match must not enqueue again'
  );
end;
$$;

select pass('only the transition into cancelled enqueues');

-- ---------------------------------------------------------------------------
-- The reason reaches the hub the notification links to
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_card public.match_hub_card;
begin
  v_match := pg_temp.full_match(v_creator, v_joiner);

  perform pg_temp.set_caller(v_creator);
  perform public.cancel_match(v_match, 'court flooded');

  -- The notification deep-links here, and `list_my_matches` drops cancelled
  -- rows, so this is the only way the reason is ever read.
  perform pg_temp.set_caller(v_joiner);
  v_card := public.get_match_hub(v_match);

  perform pg_temp.assert_true(
    v_card.status::text = 'cancelled',
    'the hub should still open for a participant after cancellation'
  );

  perform pg_temp.assert_true(
    v_card.cancellation_reason = 'court flooded',
    'the hub should carry the reason the host was made to give'
  );
end;
$$;

select pass('the cancelled hub carries the reason');

select * from finish();

rollback;
