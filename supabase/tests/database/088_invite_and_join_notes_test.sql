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

create or replace function pg_temp.open_match(
  p_creator uuid,
  p_requires_approval boolean default false
)
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
    p_requires_approval,
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

  return v_match_id;
end;
$$;

-- ---------------------------------------------------------------------------
do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_guest uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_note text;
  v_inbox_note text;
  v_payload jsonb;
begin
  v_match := pg_temp.open_match(v_host, false);
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(
    v_match,
    v_guest,
    '  Fancy a hit Saturday  https://wa.me/961  '
  );

  select mi.note into v_note
  from public.match_invitations as mi
  where mi.match_id = v_match
    and mi.invited_user_id = v_guest
    and mi.revoked_at is null;

  perform pg_temp.assert_true(
    v_note = 'Fancy a hit Saturday',
    'invite note is sanitized and stored'
  );

  select n.payload into v_payload
  from public.notifications as n
  where n.user_id = v_guest
    and n.kind = 'match_invitation'
    and n.entity_id = v_match
  order by n.created_at desc
  limit 1;

  perform pg_temp.assert_true(
    (v_payload->'params'->>'name') is not null
      and length(v_payload->'params'->>'name') > 0,
    'invite push carries inviter name, not the note'
  );
  perform pg_temp.assert_true(
    v_payload::text not like '%Fancy a hit%',
    'invite push payload does not include the note text'
  );

  perform pg_temp.set_caller(v_guest);
  select i.note into v_inbox_note
  from public.list_my_match_invites() as i
  where i.match_id = v_match;

  perform pg_temp.assert_true(
    v_inbox_note = 'Fancy a hit Saturday',
    'list_my_match_invites returns the note'
  );
end;
$$;
select pass('invite note round-trips and stays out of the push');

-- ---------------------------------------------------------------------------
do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_guest uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_raised boolean := false;
begin
  v_match := pg_temp.open_match(v_host, false);
  perform pg_temp.set_caller(v_host);

  begin
    perform public.create_match_invite(
      v_match,
      v_guest,
      repeat('x', 141)
    );
  exception
    when others then
      v_raised := sqlerrm = 'note_too_long';
  end;

  perform pg_temp.assert_true(v_raised, 'notes over 140 characters are rejected');

  perform public.create_match_invite(v_match, v_guest, '   ');
  perform pg_temp.assert_true(
    (
      select mi.note
      from public.match_invitations as mi
      where mi.match_id = v_match
        and mi.invited_user_id = v_guest
        and mi.revoked_at is null
    ) is null,
    'whitespace-only notes store as null'
  );
end;
$$;
select pass('invite note length and empty handling');

-- ---------------------------------------------------------------------------
do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_guest uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_hub public.match_hub_card;
  v_status public.participant_status;
begin
  v_match := pg_temp.open_match(v_host, true);
  perform pg_temp.set_caller(v_guest);
  v_status := public.join_match(v_match, 'Happy to play social');
  perform pg_temp.assert_true(v_status = 'requested', 'approval join returns requested');

  perform pg_temp.set_caller(v_host);
  v_hub := public.get_match_hub(v_match);
  perform pg_temp.assert_true(
    v_hub.pending_requests->0->>'join_note' = 'Happy to play social',
    'host sees join_note on pending request'
  );

  perform pg_temp.set_caller(v_guest);
  v_hub := public.get_match_hub(v_match);
  perform pg_temp.assert_true(
    jsonb_array_length(v_hub.pending_requests) = 0,
    'non-host does not see pending requests'
  );
end;
$$;
select pass('join note on approval-gated match');

-- ---------------------------------------------------------------------------
do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_guest uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_status public.participant_status;
  v_stored text;
begin
  v_match := pg_temp.open_match(v_host, false);
  perform pg_temp.set_caller(v_guest);
  v_status := public.join_match(v_match, 'should be ignored');
  perform pg_temp.assert_true(v_status = 'accepted', 'instant join accepts');

  select mp.join_note into v_stored
  from public.match_participants as mp
  where mp.match_id = v_match
    and mp.user_id = v_guest;

  perform pg_temp.assert_true(
    v_stored is null,
    'instant join ignores a smuggled note'
  );
end;
$$;
select pass('join note ignored on instant join');

-- ---------------------------------------------------------------------------
do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_guest uuid := '22222222-2222-2222-2222-222222222222';
  v_match uuid;
  v_first text;
  v_second text;
begin
  v_match := pg_temp.open_match(v_host, false);
  perform pg_temp.set_caller(v_host);
  perform public.create_match_invite(v_match, v_guest, 'first note');
  select mi.note into v_first
  from public.match_invitations as mi
  where mi.match_id = v_match
    and mi.invited_user_id = v_guest
    and mi.revoked_at is null;

  perform public.create_match_invite(v_match, v_guest, 'second note');
  select mi.note into v_second
  from public.match_invitations as mi
  where mi.match_id = v_match
    and mi.invited_user_id = v_guest
    and mi.revoked_at is null;

  perform pg_temp.assert_true(v_first = 'first note', 'first invite kept its note');
  perform pg_temp.assert_true(v_second = 'second note', 're-invite carries the new note');
  perform pg_temp.assert_true(
    (
      select count(*)::integer
      from public.match_invitations as mi
      where mi.match_id = v_match
        and mi.invited_user_id = v_guest
        and mi.revoked_at is null
    ) = 1,
    're-invite leaves one active row'
  );
end;
$$;
select pass('re-invite replaces note with the new invitation');

select * from finish();
rollback;
