\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(8);

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

-- Doubles, so an invitee can sit alongside an accepted joiner without filling
-- the roster and moving the match out of `open`. Same helper shape as `098`,
-- but open to every band: the person opening a shared link is a stranger the
-- host never picked, and the seeded stranger is a `beginner`, so a narrower
-- range would fail these fixtures on `skill_out_of_range` rather than on
-- anything this migration does.
create or replace function pg_temp.doubles_match(p_creator uuid)
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
    'beginner'::public.skill_band,
    'competitive'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (date_trunc('hour', now()) + interval '120 days')::text,
        'ends_at', (date_trunc('hour', now()) + interval '120 days 90 minutes')::text
      )
    ),
    'fixed',
    array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );
end;
$$;

-- Written straight into the table rather than through `create_match_invite`,
-- so the per-day rate limit and the per-match cap cannot make a read test
-- flaky. The one invitation that matters for creation fidelity is made through
-- the real function below.
create or replace function pg_temp.seed_invite(
  p_match_id uuid,
  p_host uuid,
  p_token text,
  p_invited uuid default null,
  p_expires_at timestamptz default null
)
returns void
language sql
as $$
  insert into public.match_invitations (
    match_id, invited_user_id, token_hash, created_by, expires_at, note
  )
  values (
    p_match_id,
    p_invited,
    public.hash_invite_token(p_token),
    p_host,
    coalesce(p_expires_at, now() + interval '7 days'),
    'come play'
  );
$$;

-- ---------------------------------------------------------------------------
-- Every way an invite can fail is reported as its own thing
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';
  v_other uuid := '88888888-8888-8888-8888-888888888888';
  v_stranger uuid := '99999999-9999-9999-9999-999999999999';
  v_match uuid;
  v_token text;
  v_preview public.match_invite_preview;
begin
  v_match := pg_temp.doubles_match(v_host);

  -- The one invitation made the real way: a shared link, no recipient.
  perform pg_temp.set_caller(v_host);
  v_token := public.create_match_invite(v_match, null, 'come play');

  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite(v_token);
  perform pg_temp.assert_true(
    v_preview.status = 'ok',
    'a live shared link reads as ok'
  );
  perform pg_temp.assert_true(
    v_preview.match_id = v_match
      and v_preview.creator_display_name is not null
      and v_preview.capacity = 4
      and v_preview.note = 'come play',
    'an ok preview carries the summary the screen renders'
  );
  perform pg_temp.assert_true(
    v_preview.zones is not null and jsonb_typeof(v_preview.zones) = 'array',
    'zones travel as the same jsonb array the hub builds'
  );

  -- A token nobody issued.
  v_preview := public.preview_match_invite('not-a-real-token');
  perform pg_temp.assert_true(
    v_preview.status = 'not_found' and v_preview.match_id is null,
    'an unknown token is not_found and discloses nothing'
  );

  -- Addressed to somebody else, then forwarded.
  perform pg_temp.seed_invite(v_match, v_host, 'tok-addressed', v_other);
  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite('tok-addressed');
  perform pg_temp.assert_true(
    v_preview.status = 'wrong_recipient',
    'an addressed invite forwarded to a third party is wrong_recipient'
  );
  perform pg_temp.assert_true(
    v_preview.match_id is null
      and v_preview.creator_display_name is null
      and v_preview.invitation_id is null,
    'a forwarded invite leaks no match details and no invitation id'
  );

  -- Withdrawn by the host.
  perform pg_temp.seed_invite(v_match, v_host, 'tok-revoked');
  update public.match_invitations
  set revoked_at = now()
  where token_hash = public.hash_invite_token('tok-revoked');
  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite('tok-revoked');
  perform pg_temp.assert_true(
    v_preview.status = 'revoked' and v_preview.match_id is null,
    'a withdrawn invite is revoked and discloses nothing'
  );

  -- Past its expiry.
  perform pg_temp.seed_invite(
    v_match, v_host, 'tok-expired', null, now() - interval '1 day'
  );
  v_preview := public.preview_match_invite('tok-expired');
  perform pg_temp.assert_true(
    v_preview.status = 'expired',
    'a lapsed invite is expired'
  );

  -- Somebody else got there first: acceptance stamps `accepted_at`, so the
  -- link is single-use and the second person is not looking at a broken one.
  perform pg_temp.set_caller(v_stranger);
  perform public.accept_match_invite(v_token);

  perform pg_temp.set_caller(v_joiner);
  v_preview := public.preview_match_invite(v_token);
  perform pg_temp.assert_true(
    v_preview.status = 'already_accepted',
    'a consumed link is already_accepted, not revoked and not expired'
  );

  -- The person who accepted it, reopening their own link.
  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite(v_token);
  perform pg_temp.assert_true(
    v_preview.status = 'already_member',
    'reopening your own accepted link says you are already in'
  );
  perform pg_temp.assert_true(
    v_preview.match_id = v_match,
    'a member still sees the match they are in'
  );
end;
$$;

select ok(true, 'preview_match_invite reports each invite state distinctly');

-- ---------------------------------------------------------------------------
-- It is a read. Calling it must not join anybody to anything.
-- ---------------------------------------------------------------------------

do $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_stranger uuid := '99999999-9999-9999-9999-999999999999';
  v_match uuid;
  v_count_before integer;
  v_count_after integer;
  v_accepted timestamptz;
  v_preview public.match_invite_preview;
begin
  v_match := pg_temp.doubles_match(v_host);
  perform pg_temp.seed_invite(v_match, v_host, 'tok-readonly');

  v_count_before := public.match_participant_count(v_match);

  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite('tok-readonly');
  perform pg_temp.assert_true(v_preview.status = 'ok', 'fixture invite is live');

  v_count_after := public.match_participant_count(v_match);

  select mi.accepted_at
  into v_accepted
  from public.match_invitations as mi
  where mi.token_hash = public.hash_invite_token('tok-readonly');

  perform pg_temp.assert_true(
    v_count_after = v_count_before,
    'previewing an invite must not add a participant'
  );
  perform pg_temp.assert_true(
    v_accepted is null,
    'previewing an invite must not consume it'
  );
end;
$$;

select ok(true, 'preview_match_invite does not mutate the roster or the invitation');

-- ---------------------------------------------------------------------------
-- The disclosure line, asserted on the shape
--
-- Checked against the returned columns rather than one payload, so a later
-- `create or replace` cannot widen what an invitee sees without failing here.
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)::int
    from pg_attribute as a
    join pg_class as c on c.oid = a.attrelid
    where c.relname = 'match_invite_preview'
      and a.attnum > 0
      and not a.attisdropped
      and a.attname in (
        'participants', 'participant_names', 'roster', 'player_names',
        'min_skill', 'max_skill', 'skill_band', 'level_range'
      )
  ),
  0,
  'the preview exposes no roster and no skill range'
);

-- By name rather than by count, so a swap cannot pass either. `is_addressed`
-- was added by `107`: whether the invitation names a recipient, so the screen
-- knows whether Decline is a server-side refusal or just leaving the page. It
-- describes the invitation, not anybody in the match.
select is(
  (
    select array_agg(a.attname::text order by a.attnum)
    from pg_attribute as a
    join pg_class as c on c.oid = a.attrelid
    where c.relname = 'match_invite_preview'
      and a.attnum > 0
      and not a.attisdropped
  ),
  array[
    'invitation_id', 'match_id', 'format', 'match_status',
    'creator_display_name', 'inviter_display_name', 'participant_count',
    'capacity', 'soonest_time', 'expires_at', 'note', 'zones', 'status',
    'is_addressed'
  ],
  'the preview is exactly the agreed fields, and no more'
);

-- ---------------------------------------------------------------------------
-- Reachable only after sign-in
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.preview_match_invite(text)', 'execute'),
  'anon cannot preview an invite'
);

select ok(
  has_function_privilege(
    'authenticated', 'public.preview_match_invite(text)', 'execute'
  ),
  'a signed-in caller can'
);

-- ---------------------------------------------------------------------------
-- The guard the token path was missing
--
-- Before this migration `accept_match_invite` handed an all-NULL rowtype to
-- `apply_match_invitation_acceptance`, where `expires_at <= now()` evaluates to
-- NULL rather than true, so the terminal-state guard did not fire and the call
-- fell through to `assert_joinable_match(NULL, ...)`.
-- ---------------------------------------------------------------------------

select pg_temp.set_caller('99999999-9999-9999-9999-999999999999');

select throws_ok(
  $$ select public.accept_match_invite('not-a-real-token') $$,
  'P0002',
  'Invite not found or expired',
  'accepting an unknown token says the invite was not found'
);

select is(
  (select count(*)::int from pg_proc where proname = 'preview_match_invite'),
  1,
  'exactly one definition'
);

select * from finish();

rollback;
