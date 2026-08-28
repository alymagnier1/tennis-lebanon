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

create or replace function pg_temp.approval_match(p_creator uuid)
returns uuid
language plpgsql
as $$
begin
  perform pg_temp.clear_hosted(p_creator);
  perform pg_temp.set_caller(p_creator);

  return public.create_and_publish_match(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    true,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '80 days')::text,
        'ends_at', (now() + interval '80 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );
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

-- ---------------------------------------------------------------------------
-- The asker can take the request back, and the host hears about it
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_asker uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_status public.participant_status;
begin
  v_match := pg_temp.approval_match(v_creator);

  perform pg_temp.set_caller(v_asker);
  perform public.join_match(v_match);

  perform public.withdraw_join_request(v_match);

  select mp.status into v_status
  from public.match_participants as mp
  where mp.match_id = v_match and mp.user_id = v_asker;

  -- `left`, never `declined`: that status records the host's answer, and 077
  -- keys the decline notification on it.
  perform pg_temp.assert_true(
    v_status::text = 'left',
    'a withdrawn request should leave the row as left'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_creator, 'match_request_withdrawn', v_match) = 1,
    'the host should be told the request was withdrawn'
  );

  perform pg_temp.assert_true(
    pg_temp.notification_count(v_asker, 'match_request_declined', v_match) = 0,
    'withdrawing must not read to the asker as a rejection'
  );

  -- 088 reactivates left/declined/removed rows, so asking again still works.
  perform pg_temp.assert_true(
    public.join_match(v_match)::text = 'requested',
    'a player who withdrew should be able to ask again'
  );
end;
$$;

select pass('a request can be withdrawn');
select pass('the host is told about a withdrawal');
select pass('a withdrawal is not a decline');
select pass('the asker can request again afterwards');

-- ---------------------------------------------------------------------------
-- Nothing to withdraw is an error, not a silent no-op
-- ---------------------------------------------------------------------------

do $$
declare
  v_creator uuid := '11111111-1111-1111-1111-111111111111';
  v_other uuid := '66666666-6666-6666-6666-666666666666';
  v_match uuid;
begin
  v_match := pg_temp.approval_match(v_creator);

  perform pg_temp.set_caller(v_other);
  begin
    perform public.withdraw_join_request(v_match);
    raise exception 'withdrawing without a pending request should fail';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'no_pending_request' then
        raise exception 'expected no_pending_request, got %', sqlerrm;
      end if;
  end;
end;
$$;

select * from finish();

rollback;
