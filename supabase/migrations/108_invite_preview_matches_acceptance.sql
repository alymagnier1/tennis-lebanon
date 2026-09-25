-- An invite preview must never promise what acceptance will refuse, and must
-- never show a blocked person anything. Part 2 of 2; `107` added the types.
--
-- `preview_match_invite` (105) checked the invitation and the roster, and
-- stopped there. Acceptance goes on through `assert_joinable_match`, which also
-- refuses a blocked relationship, a band outside the match's range, and a
-- match with no future time. Each gap was reproduced in the 2026-09-25 review:
--
--   * Blocked. The preview returned the host's and inviter's names, the time,
--     the zones and the note to a player who had been blocked after receiving
--     the link. Acceptance refused them; the disclosure had already happened.
--     A blocked caller now gets `not_found` and nothing else -- the same answer
--     as a token that never existed, so the preview does not reveal the block
--     either. Checked in both directions and against every live participant,
--     exactly as acceptance does, plus the match creator and the inviter by
--     name, because those two names are what the preview would print.
--   * Skill. A band outside the range is certain to fail, so it is reported as
--     `skill_out_of_range` with the summary (the caller holds a genuine link),
--     and Accept is not offered. The range itself stays out of the payload.
--   * No future time. Acceptance raises `match_has_no_future_times`; the
--     preview now says `unavailable`, the copy for a match no longer taking
--     players.
--
-- The checks copy `assert_joinable_match` expression for expression, so an
-- unknown band passes both. Acceptance stays authoritative; this only stops the
-- screen from offering a button that cannot work.
--
-- `decline_match_invitation` is also restated. It matched addressed invitations
-- only, so a Decline on a shared link raised `P0002`. The screen now leaves a
-- shared link instead of calling it, but builds already installed still call
-- it, so a live shared invitation is now a no-op here rather than an error.
-- Revoking it would withdraw the link from everybody else it was sent to.

create or replace function public.preview_match_invite(p_token text)
returns public.match_invite_preview
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_invite public.match_invitations%rowtype;
  v_match public.matches%rowtype;
  v_preview public.match_invite_preview;
  v_capacity integer;
  v_count integer;
  v_is_member boolean;
  v_band public.skill_band;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_invite
  from public.match_invitations as mi
  where mi.token_hash = public.hash_invite_token(p_token);

  if not found then
    v_preview.status := 'not_found';
    return v_preview;
  end if;

  select *
  into v_match
  from public.matches as m
  where m.id = v_invite.match_id;

  if not found then
    v_preview.status := 'not_found';
    return v_preview;
  end if;

  v_is_member := exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = v_match.id
      and mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  );

  -- Before anything is read into the payload. A member is exempt: they are
  -- already in the match, and the hub is where they deal with it.
  if not v_is_member
     and (
       public.is_blocked_from_match(v_user_id, v_match.id)
       or public.is_blocked(v_user_id, v_match.creator_id)
       or public.is_blocked(v_user_id, v_invite.created_by)
     ) then
    v_preview.status := 'not_found';
    return v_preview;
  end if;

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(v_match.id);

  select pp.skill_band
  into v_band
  from public.player_profiles as pp
  where pp.user_id = v_user_id;

  -- Order is the product decision, not an implementation detail. Membership is
  -- read before expiry so that somebody who accepted and later reopens their
  -- own link is told they are already in, rather than that the invite expired.
  if v_is_member then
    v_preview.status := 'already_member';
  elsif v_invite.invited_user_id is not null
     and v_invite.invited_user_id <> v_user_id then
    v_preview.status := 'wrong_recipient';
  elsif v_invite.revoked_at is not null then
    v_preview.status := 'revoked';
  elsif v_invite.accepted_at is not null then
    -- Acceptance consumes the invitation, so a link pasted into a group chat
    -- works exactly once. The second person is not looking at a broken link.
    v_preview.status := 'already_accepted';
  elsif v_invite.expires_at <= now() then
    v_preview.status := 'expired';
  elsif v_invite.superseded_at is not null
     or v_match.status = 'ready_to_book'
     or v_count >= v_capacity then
    -- `superseded_at` is set while the roster is full and cleared when a seat
    -- reopens, so it is the same fact as a full match.
    v_preview.status := 'full';
  elsif v_match.status not in ('open', 'full') then
    v_preview.status := 'unavailable';
  elsif not exists (
    select 1
    from public.match_time_options as mto
    where mto.match_id = v_match.id
      and mto.withdrawn_at is null
      and mto.ends_at > now()
  ) then
    -- `assert_joinable_match` raises `match_has_no_future_times` here.
    v_preview.status := 'unavailable';
  elsif public.skill_band_rank(v_band) < public.skill_band_rank(v_match.min_skill)
     or public.skill_band_rank(v_band) > public.skill_band_rank(v_match.max_skill) then
    -- The same comparison `assert_joinable_match` makes, so a null band passes
    -- here exactly as it passes there.
    v_preview.status := 'skill_out_of_range';
  else
    v_preview.status := 'ok';
  end if;

  -- Three outcomes disclose nothing but themselves: a withdrawn invitation is
  -- the host taking the offer back, and an addressed invitation forwarded to a
  -- third party was never that person's to read.
  if v_preview.status in ('not_found', 'wrong_recipient', 'revoked') then
    return v_preview;
  end if;

  v_preview.invitation_id := v_invite.id;
  v_preview.is_addressed := v_invite.invited_user_id is not null;
  v_preview.match_id := v_match.id;
  v_preview.format := v_match.format;
  v_preview.match_status := v_match.status;
  v_preview.creator_display_name := (
    select p.display_name
    from public.profiles as p
    where p.id = v_match.creator_id
  );
  v_preview.inviter_display_name := (
    select p.display_name
    from public.profiles as p
    where p.id = v_invite.created_by
  );
  v_preview.participant_count := v_count;
  v_preview.capacity := v_capacity;
  v_preview.soonest_time := (
    select min(mto.starts_at)
    from public.match_time_options as mto
    where mto.match_id = v_match.id
      and mto.withdrawn_at is null
      and mto.ends_at > now()
  );
  v_preview.expires_at := v_invite.expires_at;
  v_preview.note := v_invite.note;
  v_preview.zones := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', z.id, 'slug', z.slug, 'name_i18n', z.name_i18n)
      ),
      '[]'::jsonb
    )
    from public.match_zones as mz
    join public.zones as z on z.id = mz.zone_id
    where mz.match_id = v_match.id
  );

  return v_preview;
end;
$$;

create or replace function public.decline_match_invitation(p_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

  update public.match_invitations as mi
  set revoked_at = now(),
      declined_at = now()
  where mi.id = p_invitation_id
    and mi.invited_user_id = v_user_id
    and mi.revoked_at is null
    and mi.accepted_at is null
    and mi.expires_at > now();

  if found then
    return;
  end if;

  -- A live shared link has no recipient to refuse on behalf of, and revoking
  -- it would withdraw it from everyone else it was sent to. Leaving it is the
  -- whole of declining it.
  if exists (
    select 1
    from public.match_invitations as mi
    where mi.id = p_invitation_id
      and mi.invited_user_id is null
      and mi.revoked_at is null
      and mi.accepted_at is null
      and mi.expires_at > now()
  ) then
    return;
  end if;

  raise exception using errcode = 'P0002', message = 'Invite not found or expired';
end;
$$;

revoke all on function public.preview_match_invite(text) from public, anon;
grant execute on function public.preview_match_invite(text) to authenticated;

revoke all on function public.decline_match_invitation(uuid) from public, anon;
grant execute on function public.decline_match_invitation(uuid) to authenticated;
