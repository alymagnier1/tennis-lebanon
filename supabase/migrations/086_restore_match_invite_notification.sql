-- A targeted invite tells the person it was sent to.
--
-- `021` gave `create_match_invite` an `enqueue_notification` call, so an invite
-- aimed at a specific player produced a `match_invitation` for them. `044` added
-- the 20-a-day rate limit and rebuilt the function from a pre-`021` ancestor,
-- silently dropping that call along with the `returning id` its dedupe key was
-- built from. Nothing failed and no test covered it, so since `044` every
-- targeted invite has notified nobody: the invited player found out only by
-- opening Matches -> Invites unprompted, or by being sent the share link.
--
-- Found while verifying `085`, which makes invites markedly easier to send --
-- a card invite is now one tap -- so an invite nobody hears about became a
-- bigger hole than it was.
--
-- Body is `044` verbatim, diffed against the live definition first, with the
-- declaration, the `returning`, and the notification block added back. The
-- payload carries only `deepLink`, matching `077` and every recent kind: the
-- title and body come from `notifications.kinds.match_invitation` in the locale
-- bundles and from `notification-copy.ts`, all of which already exist. `021`'s
-- hardcoded English strings are deliberately not restored with it.

create or replace function public.create_match_invite(
  p_match_id uuid,
  p_invited_user_id uuid default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_token text;
  v_token_hash text;
  v_invitation_id uuid;
begin
  v_user_id := public.assert_marketplace_caller();

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

  -- After authorization, so someone with no business here is turned away for
  -- that reason rather than being told about the quota.
  perform public.enforce_invite_rate_limit(v_user_id);

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
    expires_at
  )
  values (
    p_match_id,
    p_invited_user_id,
    v_token_hash,
    v_user_id,
    now() + interval '14 days'
  )
  returning id into v_invitation_id;

  -- Only a targeted invite has somebody to notify. A share-link invite carries
  -- no invited_user_id, and reaches its recipient through the link itself.
  if p_invited_user_id is not null then
    perform public.enqueue_notification(
      p_invited_user_id,
      'match_invitation',
      'match',
      p_match_id,
      format('match_invitation:%s', v_invitation_id),
      jsonb_build_object('deepLink', format('/match/%s', p_match_id)),
      now()
    );
  end if;

  return v_token;
end;
$$;

revoke all on function public.create_match_invite(uuid, uuid) from public, anon;
grant execute on function public.create_match_invite(uuid, uuid) to authenticated;
