-- An invite link joined you to the match before you had seen it.
--
-- `app/invite/[token].tsx` fired `accept_match_invite` from an effect the
-- moment auth resolved, so opening the link was accepting it. That lands worst
-- on exactly the person the link exists for: `create_match_invite` takes a null
-- recipient precisely so a host can share a link with somebody who is not on
-- RacketBound at all, which means the auto-accept ran on a brand-new account
-- seconds after sign-up, committing a stranger to a time, a place and three
-- other people before showing them any of it.
--
-- The addressed-invite inbox already asks first -- `list_my_match_invites`
-- renders a summary and `accept_match_invitation` / `decline_match_invitation`
-- answer it -- but it cannot serve a shared link, because it selects on
-- `invited_user_id = auth.uid()` and a shared link has no recipient. So the
-- link needed its own read of the same facts, and none existed:
-- `match_invitations` has RLS on with no policy, the token is stored hashed,
-- and the only function that took a token was the one that accepted it.
--
-- `preview_match_invite` is that read. It returns what the inbox row already
-- shows an invitee, plus the match's zones -- a link recipient is deciding
-- whether to cross the city, and area is the one fact an inbox invite never had
-- to carry, because the host had already picked that person. It stops there on
-- purpose: no roster and no skill range, because naming an existing participant
-- to a stranger who has not joined, and may decline, discloses somebody who
-- never agreed to it.
--
-- The status column carries the rest, and is the reason this is not just a
-- select. Every way an invite can fail was one exception before -- `P0002
-- Invite not found or expired` covered a withdrawn link, a link somebody else
-- already used, a typo and a full match alike -- and a screen cannot explain
-- what it cannot tell apart.
create type public.match_invite_preview_status as enum (
  'ok',
  'not_found',
  'wrong_recipient',
  'revoked',
  'already_accepted',
  'already_member',
  'expired',
  'full',
  'unavailable'
);

create type public.match_invite_preview as (
  -- Carried so Decline can be a real refusal. `decline_match_invitation`
  -- stamps `declined_at` for an addressed invitation and matches nothing for a
  -- shared link, which has no recipient to refuse on behalf of -- so one call
  -- serves both and the word means the same thing here as it does in the
  -- inbox. Withheld with the rest of the payload when the status does not
  -- disclose.
  invitation_id uuid,
  match_id uuid,
  format public.match_format,
  match_status public.match_status,
  creator_display_name text,
  inviter_display_name text,
  participant_count integer,
  capacity integer,
  soonest_time timestamptz,
  expires_at timestamptz,
  note text,
  zones jsonb,
  status public.match_invite_preview_status
);

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

  v_capacity := public.match_capacity_for_format(v_match.format);
  v_count := public.match_participant_count(v_match.id);

  -- Order is the product decision, not an implementation detail. Membership is
  -- read before expiry so that somebody who accepted and later reopens their
  -- own link is told they are already in, rather than that the invite expired
  -- -- which is true of the invitation and useless to the person holding it.
  if exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = v_match.id
      and mp.user_id = v_user_id
      and mp.status in ('accepted', 'requested', 'invited')
  ) then
    v_preview.status := 'already_member';
  elsif v_invite.invited_user_id is not null
     and v_invite.invited_user_id <> v_user_id then
    v_preview.status := 'wrong_recipient';
  elsif v_invite.revoked_at is not null then
    v_preview.status := 'revoked';
  elsif v_invite.accepted_at is not null then
    -- Acceptance consumes the invitation: `apply_match_invitation_acceptance`
    -- stamps `accepted_at`, so a link pasted into a group chat works exactly
    -- once. The second person is not looking at a broken link, and should not
    -- be told the invite was withdrawn.
    v_preview.status := 'already_accepted';
  elsif v_invite.expires_at <= now() then
    v_preview.status := 'expired';
  elsif v_invite.superseded_at is not null
     or v_match.status = 'ready_to_book'
     or v_count >= v_capacity then
    -- `superseded_at` is the one non-terminal state -- set while the roster is
    -- full and cleared when a seat reopens -- so it is the same fact as a full
    -- match, not a cancelled invitation.
    v_preview.status := 'full';
  elsif v_match.status not in ('open', 'full') then
    v_preview.status := 'unavailable';
  else
    v_preview.status := 'ok';
  end if;

  -- Three outcomes disclose nothing but themselves. A withdrawn invitation is
  -- the host taking the offer back, and an addressed invitation forwarded to a
  -- third party was never that person's to read; in both cases the match
  -- details would be a leak dressed as an error state.
  if v_preview.status in ('not_found', 'wrong_recipient', 'revoked') then
    return v_preview;
  end if;

  v_preview.invitation_id := v_invite.id;
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
  -- The same shape `get_match_hub` builds, so the client formats area with the
  -- localizer it already has. `zones.name_i18n` is jsonb; picking a language
  -- here would hard-code one and break Arabic and French.
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

-- The token path has been missing the guard its sibling has since `010`.
--
-- `accept_match_invitation(p_invitation_id)` raises `P0002` when the id matches
-- nothing. `accept_match_invite(p_token)` never checked, and handed an all-NULL
-- rowtype to `apply_match_invitation_acceptance`, where the terminal-state guard
-- reads `revoked_at is not null or accepted_at is not null or expires_at <=
-- now()`. On an absent row that expression is NULL rather than true, so the
-- guard does not fire and execution falls through to
-- `assert_joinable_match(NULL, ...)` -- turning a mistyped or purged token into
-- an error about a match that was never named.
--
-- Restated whole rather than patched, because `create or replace` needs the
-- full body; the only change is the `if not found` block.
create or replace function public.accept_match_invite(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_invite public.match_invitations%rowtype;
begin
  v_user_id := public.assert_marketplace_caller();

  select *
  into v_invite
  from public.match_invitations as mi
  where mi.token_hash = public.hash_invite_token(p_token)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Invite not found or expired';
  end if;

  return public.apply_match_invitation_acceptance(v_invite, v_user_id);
end;
$$;

revoke all on function public.preview_match_invite(text) from public, anon;
grant execute on function public.preview_match_invite(text) to authenticated;

revoke all on function public.accept_match_invite(text) from public, anon;
grant execute on function public.accept_match_invite(text) to authenticated;
