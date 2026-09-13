-- A host could not take an invitation back, and could send one to a match
-- nobody could join.
--
-- **Taking it back.** `revoke_pending_targeted_invites` (010) is the only thing
-- that writes `revoked_at` for a withdrawal, and it is
-- `revoke all ... from authenticated` with no RPC wrapping it. So the hub's
-- "Invited" section (093/094) is a read-only list of badges on a screen where
-- every other section acts, and a host who invited the wrong player, or three
-- players for one seat, has no way to undo it. The 2026-08-28 entry that built
-- that section reasons about "a host revoke" as though the path existed.
--
-- **The lost guard.** `021` checked `m.status in ('draft','open','full')` and
-- raised `match_not_invitable`. `044` rewrote `create_match_invite` to add the
-- rate limit and dropped that check; `086` and `088` each rewrote the function
-- again and carried the omission forward. Today an invitation can be created
-- for a `completed`, `cancelled`, `booking_pending` or `confirmed` match: the
-- insert succeeds, a push goes out, the daily quota is spent, and accepting it
-- then fails `match_not_joinable` behind the generic error. Capacity was never
-- checked at all, so the same is true of a match that is simply full.
--
-- **The cap.** Nothing limited how many people could hold a pending invitation
-- to one seat. First-accept-wins is the intended design (2026-07-26), and
-- over-inviting is the right way to fill a match, but the only ceiling was the
-- 20-per-day rate limit across every match the host owns.

-- Takes the match and the player, not an invitation id, for two reasons.
-- `get_match_hub.invited_players` carries `user_id` and no invitation id, so an
-- id-keyed function could not be called from the one screen that needs it
-- without also widening that payload; and `respond_to_join_request` already
-- established `(match_id, user_id)` as the shape for a host acting on somebody
-- else's row. `decline_match_invitation` keeps its id argument because the
-- invitee reads that id from their own inbox.
--
-- Authorized to the invitation's creator *or* the match creator. Any accepted
-- participant may invite (2026-08-28) -- that is what lets somebody who joined
-- a doubles match go and find the fourth -- so the player who sent an invite
-- must be able to take it back. The host keeps the broader power because the
-- match is theirs.
--
-- Writes `revoked_at` and leaves `declined_at` null, which is exactly the
-- distinction `093` added that column for: both a withdrawal and a refusal
-- revoke the invitation, and only the refusal is the invitee's answer. A
-- withdrawal must therefore stay out of `invited_players`' declined count.
create or replace function public.cancel_match_invite(
  p_match_id uuid,
  p_invited_user_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_creator_id uuid;
  v_created_by uuid;
  v_invite_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  select m.creator_id
  into v_creator_id
  from public.matches as m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  -- A declined invitation already carries `revoked_at`, so it is excluded here
  -- along with accepted and expired ones. Clearing a decline off the hub is a
  -- different feature and not this one: the host asked, the player answered,
  -- and that answer is the record.
  --
  -- `create_match_invite` revokes any prior invitation to the same player
  -- before inserting, so at most one row can match. Ordered and limited anyway
  -- rather than relying on that: a uniqueness rule enforced only by another
  -- function's body is not one this can depend on.
  select mi.id, mi.created_by
  into v_invite_id, v_created_by
  from public.match_invitations as mi
  where mi.match_id = p_match_id
    and mi.invited_user_id = p_invited_user_id
    and mi.accepted_at is null
    and mi.revoked_at is null
    and mi.expires_at > now()
  order by mi.created_at desc
  limit 1
  for update;

  if v_invite_id is null then
    raise exception using errcode = 'P0002', message = 'Invite not found or expired';
  end if;

  if v_created_by <> v_user_id
     and v_creator_id is distinct from v_user_id then
    raise exception using errcode = '42501', message = 'Not your invite to withdraw';
  end if;

  update public.match_invitations
  set revoked_at = now()
  where id = v_invite_id;
end;
$$;

revoke all on function public.cancel_match_invite(uuid, uuid) from public, anon;
grant execute on function public.cancel_match_invite(uuid, uuid) to authenticated;

-- `088`'s body, with three guards restored or added between authorization and
-- the rate limit. Signature is unchanged, so `create or replace` keeps the ACL.
create or replace function public.create_match_invite(
  p_match_id uuid,
  p_invited_user_id uuid default null,
  p_note text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_participants integer;
  v_pending integer;
  v_token text;
  v_token_hash text;
  v_invitation_id uuid;
  v_note text;
  v_inviter_name text;
begin
  v_user_id := public.assert_marketplace_caller();

  -- Locked for the cap count below, which is otherwise racy between two
  -- participants inviting at once.
  select *
  into v_match
  from public.matches as m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Match not found';
  end if;

  if not exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = v_user_id
      and mp.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Only participants can invite';
  end if;

  if p_invited_user_id is not null
     and public.is_blocked(v_user_id, p_invited_user_id) then
    raise exception using errcode = '42501', message = 'Blocked relationship';
  end if;

  -- Every check from here down sits *after* authorization, so somebody with no
  -- business on this match is turned away for that reason rather than being
  -- told its status, its roster, or the host's quota. `021` ordered the status
  -- check first; this is the ordering `044` established for the rate limit and
  -- it is the better one.
  if v_match.status not in ('draft', 'open', 'full') then
    raise exception using errcode = 'P0001', message = 'match_not_invitable';
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_participants := public.match_participant_count(p_match_id);

  -- Status `full` is reachable above and lands here, which is deliberate:
  -- `match_full` says which of the two things is wrong.
  if v_participants >= v_capacity then
    raise exception using errcode = 'P0001', message = 'match_full';
  end if;

  -- Open seats plus two. Enough slack for first-accept-wins to do its job --
  -- a singles host can ask three people for one seat -- without letting one
  -- match page the whole player base.
  --
  -- The target is excluded from the count because the block below revokes any
  -- invitation they already hold, so re-inviting somebody replaces their row
  -- rather than adding one. Counting it would refuse a re-invite at the cap.
  -- Share-link invitations have no recipient and no seat claim; the daily rate
  -- limit is what covers those.
  if p_invited_user_id is not null then
    select count(*)
    into v_pending
    from public.match_invitations as mi
    where mi.match_id = p_match_id
      and mi.invited_user_id is not null
      and mi.invited_user_id <> p_invited_user_id
      and mi.accepted_at is null
      and mi.revoked_at is null
      and mi.expires_at > now();

    if v_pending >= (v_capacity - v_participants) + 2 then
      raise exception using errcode = 'P0001', message = 'invite_cap_reached';
    end if;
  end if;

  perform public.enforce_invite_rate_limit(v_user_id);

  -- Share-link invites have no recipient; a note would hang on a link with no
  -- one to show it to, so only targeted invites keep it.
  if p_invited_user_id is not null then
    v_note := public.sanitize_player_note(p_note);
  else
    v_note := null;
  end if;

  if p_invited_user_id is not null then
    update public.match_invitations as mi
    set revoked_at = now()
    where mi.match_id = p_match_id
      and mi.invited_user_id = p_invited_user_id
      and mi.revoked_at is null
      and mi.accepted_at is null;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := public.hash_invite_token(v_token);

  insert into public.match_invitations (
    match_id,
    invited_user_id,
    token_hash,
    created_by,
    expires_at,
    note
  )
  values (
    p_match_id,
    p_invited_user_id,
    v_token_hash,
    v_user_id,
    now() + interval '14 days',
    v_note
  )
  returning id into v_invitation_id;

  if p_invited_user_id is not null then
    select p.display_name
    into v_inviter_name
    from public.profiles as p
    where p.id = v_user_id;

    perform public.enqueue_notification(
      p_invited_user_id,
      'match_invitation',
      'match',
      p_match_id,
      format('match_invitation:%s', v_invitation_id),
      jsonb_build_object(
        'deepLink', format('/match/%s', p_match_id),
        'params', jsonb_build_object('name', coalesce(v_inviter_name, ''))
      ),
      now()
    );
  end if;

  return v_token;
end;
$$;

revoke all on function public.create_match_invite(uuid, uuid, text) from public, anon;
grant execute on function public.create_match_invite(uuid, uuid, text) to authenticated;
