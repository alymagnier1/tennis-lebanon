begin;

create extension if not exists pgtap;
select plan(24);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

-- Same fixture as `105`: doubles, open to every band, one fixed slot four
-- months out, so the only thing standing between a caller and `ok` is the
-- condition each block below sets up.
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

create or replace function pg_temp.seed_invite(
  p_match_id uuid,
  p_host uuid,
  p_token text,
  p_invited uuid default null
)
returns void
language sql
as $$
  insert into public.match_invitations (
    match_id, invited_user_id, token_hash, created_by, expires_at, note
  )
  values (
    p_match_id, p_invited, public.hash_invite_token(p_token), p_host,
    now() + interval '7 days', 'come play'
  );
$$;

-- True when the preview carries nothing but its status: no id to act on, no
-- names, no time, no place, no note.
create or replace function pg_temp.discloses_nothing(p public.match_invite_preview)
returns boolean
language sql
as $$
  select p.invitation_id is null
    and p.is_addressed is null
    and p.match_id is null
    and p.creator_display_name is null
    and p.inviter_display_name is null
    and p.participant_count is null
    and p.soonest_time is null
    and p.note is null
    and p.zones is null;
$$;

create or replace function pg_temp.invite_preview_matches_acceptance()
returns setof text
language plpgsql
as $$
declare
  v_host uuid := '11111111-1111-1111-1111-111111111111';     -- intermediate
  v_joiner uuid := '22222222-2222-2222-2222-222222222222';   -- improving
  v_other uuid := '88888888-8888-8888-8888-888888888888';    -- improving
  v_stranger uuid := '99999999-9999-9999-9999-999999999999'; -- beginner
  v_match uuid;
  v_shared text;
  v_preview public.match_invite_preview;
begin
  v_match := pg_temp.doubles_match(v_host);
  perform pg_temp.set_caller(v_host);
  v_shared := public.create_match_invite(v_match, null, 'come play');
  perform pg_temp.seed_invite(v_match, v_host, 'tok-108-addressed', v_other);

  -- -------------------------------------------------------------------------
  -- Decline: the preview says which kind of invitation it is, and a Decline
  -- on a shared link no longer fails or withdraws it from everyone.
  -- -------------------------------------------------------------------------

  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite(v_shared);
  return next ok(
    v_preview.status = 'ok' and v_preview.is_addressed = false,
    'a shared link previews as ok and not addressed');

  perform pg_temp.set_caller(v_other);
  v_preview := public.preview_match_invite('tok-108-addressed');
  return next ok(
    v_preview.status = 'ok' and v_preview.is_addressed = true,
    'an invitation addressed to the caller previews as addressed');

  return next lives_ok(
    format('select public.decline_match_invitation(%L::uuid)', v_preview.invitation_id),
    'declining an addressed invitation succeeds');
  return next ok(
    exists (
      select 1 from public.match_invitations
      where token_hash = public.hash_invite_token('tok-108-addressed')
        and declined_at is not null and revoked_at is not null
    ),
    'declining an addressed invitation records the refusal on the server');

  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite(v_shared);
  return next lives_ok(
    format('select public.decline_match_invitation(%L::uuid)', v_preview.invitation_id),
    'declining a shared link from an older build no longer raises');
  return next ok(
    exists (
      select 1 from public.match_invitations
      where token_hash = public.hash_invite_token(v_shared)
        and revoked_at is null and declined_at is null
    ),
    'declining a shared link does not withdraw it');
  perform pg_temp.set_caller(v_joiner);
  return next is(
    (public.preview_match_invite(v_shared)).status::text, 'ok',
    'after one person declines, the shared link still works for the next');

  perform pg_temp.set_caller(v_stranger);
  return next throws_ok(
    format('select public.decline_match_invitation(%L::uuid)', gen_random_uuid()),
    'P0002', 'Invite not found or expired',
    'declining an id that matches nothing still raises');

  -- -------------------------------------------------------------------------
  -- Skill: the preview refuses exactly who acceptance refuses.
  -- -------------------------------------------------------------------------

  update public.matches set min_skill = 'intermediate' where id = v_match;
  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite(v_shared);
  return next is(
    v_preview.status::text, 'skill_out_of_range',
    'a band below the range previews as skill_out_of_range, not ok');
  return next ok(
    v_preview.match_id = v_match and v_preview.soonest_time is not null,
    'a genuine recipient out of range still sees the summary that explains it');
  return next throws_ok(
    format('select public.accept_match_invite(%L)', v_shared),
    'P0001', 'skill_out_of_range',
    'acceptance refuses the same band the preview did');

  update public.matches set min_skill = 'beginner', max_skill = 'beginner' where id = v_match;
  perform pg_temp.set_caller(v_joiner);
  return next is(
    (public.preview_match_invite(v_shared)).status::text, 'skill_out_of_range',
    'a band above the range previews as skill_out_of_range');

  update public.matches set max_skill = 'competitive' where id = v_match;
  perform pg_temp.set_caller(v_stranger);
  return next is(
    (public.preview_match_invite(v_shared)).status::text, 'ok',
    'back inside the range, the same link previews as ok');

  -- -------------------------------------------------------------------------
  -- No future time: acceptance raises match_has_no_future_times.
  -- -------------------------------------------------------------------------

  update public.match_time_options
  set starts_at = now() - interval '3 hours', ends_at = now() - interval '90 minutes'
  where match_id = v_match;
  return next is(
    (public.preview_match_invite(v_shared)).status::text, 'unavailable',
    'a match whose times have all passed previews as unavailable');
  return next throws_ok(
    format('select public.accept_match_invite(%L)', v_shared),
    'P0001', 'match_has_no_future_times',
    'acceptance refuses the same match');

  update public.match_time_options
  set starts_at = date_trunc('hour', now()) + interval '120 days',
      ends_at = date_trunc('hour', now()) + interval '120 days 90 minutes'
  where match_id = v_match;

  -- -------------------------------------------------------------------------
  -- Blocked: nothing is disclosed, whichever side made the block.
  -- -------------------------------------------------------------------------

  insert into public.user_blocks (blocker_id, blocked_id) values (v_host, v_stranger);
  perform pg_temp.set_caller(v_stranger);
  v_preview := public.preview_match_invite(v_shared);
  return next is(
    v_preview.status::text, 'not_found',
    'a player the host blocked sees not_found, as if the link did not exist');
  return next ok(
    pg_temp.discloses_nothing(v_preview),
    'a player the host blocked receives no names, time, zones or note');
  return next throws_ok(
    format('select public.accept_match_invite(%L)', v_shared),
    '42501', 'Blocked relationship',
    'acceptance refuses the same blocked player');

  delete from public.user_blocks where blocker_id = v_host and blocked_id = v_stranger;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_stranger, v_host);
  v_preview := public.preview_match_invite(v_shared);
  return next ok(
    v_preview.status = 'not_found' and pg_temp.discloses_nothing(v_preview),
    'a player who blocked the host sees not_found and nothing else');

  -- Blocked with a participant other than the host.
  delete from public.user_blocks where blocker_id = v_stranger and blocked_id = v_host;
  insert into public.match_participants (match_id, user_id, status, is_creator, joined_at)
  values (v_match, v_joiner, 'accepted', false, now());
  insert into public.user_blocks (blocker_id, blocked_id) values (v_joiner, v_stranger);
  v_preview := public.preview_match_invite(v_shared);
  return next ok(
    v_preview.status = 'not_found' and pg_temp.discloses_nothing(v_preview),
    'a block with any participant, not only the host, discloses nothing');
  return next throws_ok(
    format('select public.accept_match_invite(%L)', v_shared),
    '42501', 'Blocked relationship',
    'acceptance refuses a block with any participant too');

  -- A block with somebody outside the match is none of this match's business.
  delete from public.user_blocks where blocker_id = v_joiner and blocked_id = v_stranger;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_other, v_stranger);
  return next is(
    (public.preview_match_invite(v_shared)).status::text, 'ok',
    'a block with a non-participant does not hide the match');

  -- A member is not locked out of their own link by a later block.
  delete from public.user_blocks where blocker_id = v_other and blocked_id = v_stranger;
  perform public.accept_match_invite(v_shared);
  insert into public.user_blocks (blocker_id, blocked_id) values (v_joiner, v_stranger);
  v_preview := public.preview_match_invite(v_shared);
  return next ok(
    v_preview.status = 'already_member' and v_preview.match_id = v_match,
    'a member blocked after joining is still told they are in, and where');

  -- Still a read.
  return next is(
    (select count(*)::int from public.match_participants
     where match_id = v_match and status = 'accepted'),
    3,
    'previewing never joined anybody: only the host, the seeded joiner and one acceptance');
end;
$$;

select * from pg_temp.invite_preview_matches_acceptance();
select * from finish();

rollback;
