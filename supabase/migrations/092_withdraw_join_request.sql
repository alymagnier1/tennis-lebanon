-- A join request could not be taken back.
--
-- `leave_match` requires `mp.status = 'accepted'` (030) and otherwise raises
-- "Not an active participant", so a player who asked to join an approval-gated
-- match had no way out: the request sat there until the host answered, and the
-- 090 conflict rule now means a pending request can block nothing but is itself
-- unremovable clutter on the asker's list. Found in the Phase 0.3 rehearsal.
--
-- The row goes to `left`, not `declined`. `declined` means the host said no,
-- and overloading it would corrupt the one status that records the host's
-- answer -- `077` keys the decline notification on exactly that transition, so
-- reusing it here would tell the asker their own withdrawal was a rejection.
-- `left` also already reactivates on rejoin (`088`), so asking again later
-- works with no further change.
--
-- The host is told. They may have been holding a slot for an answer, and the
-- request notification they got from `076` would otherwise point at a hub with
-- nothing pending on it.

create or replace function public.withdraw_join_request(p_match_id uuid)
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

  update public.match_participants as mp
  set
    status = 'left',
    left_at = now(),
    join_note = null
  where mp.match_id = p_match_id
    and mp.user_id = v_user_id
    and mp.status = 'requested';

  if not found then
    raise exception using errcode = 'P0002', message = 'no_pending_request';
  end if;
end;
$$;

revoke all on function public.withdraw_join_request(uuid) from public, anon;
grant execute on function public.withdraw_join_request(uuid) to authenticated;

create or replace function public.notify_match_roster_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_was_accepted boolean;
  v_was_requested boolean;
  v_bucket bigint;
  v_creator_id uuid;
begin
  -- OLD is unassigned on INSERT and PL/pgSQL evaluates the whole boolean
  -- expression as one SQL query rather than short-circuiting, so this has to
  -- branch on tg_op before touching old.
  if tg_op = 'INSERT' then
    v_was_accepted := false;
    v_was_requested := false;
  else
    v_was_accepted := old.status = 'accepted';
    v_was_requested := old.status = 'requested';
  end if;

  -- Same 15-minute bucket the chat throttle uses. A player who joins, leaves
  -- and rejoins within a few minutes collapses to one notification of each
  -- kind, while a genuine drop-out hours later still gets through.
  v_bucket := floor(extract(epoch from now()) / 900)::bigint;

  if new.status = 'accepted' and not v_was_accepted then
    perform public.notify_match_participants(
      new.match_id,
      'match_participant_joined',
      new.user_id,
      format('%s:%s:%s', new.match_id, new.user_id, v_bucket)
    );

    -- The call above deliberately excludes the subject. A player promoted out
    -- of `requested` is the one person who still needs telling, so they are
    -- told here and only here.
    if v_was_requested then
      perform public.enqueue_notification(
        new.user_id,
        'match_request_accepted',
        'match',
        new.match_id,
        format(
          'match_request_accepted:%s:%s:%s',
          new.match_id,
          new.user_id,
          v_bucket
        ),
        jsonb_build_object('deepLink', format('/match/%s', new.match_id)),
        now()
      );
    end if;
  elsif new.status = 'requested' and not v_was_requested then
    select m.creator_id into v_creator_id
    from public.matches as m
    where m.id = new.match_id;

    -- Guard against a creator somehow holding a requested row: never notify
    -- someone about their own action.
    if v_creator_id is not null and v_creator_id <> new.user_id then
      perform public.enqueue_notification(
        v_creator_id,
        'match_join_request',
        'match',
        new.match_id,
        format(
          'match_join_request:%s:%s:%s',
          new.match_id,
          new.user_id,
          v_bucket
        ),
        jsonb_build_object('deepLink', format('/match/%s', new.match_id)),
        now()
      );
    end if;
  elsif v_was_requested and new.status = 'declined' then
    perform public.enqueue_notification(
      new.user_id,
      'match_request_declined',
      'match',
      new.match_id,
      format(
        'match_request_declined:%s:%s:%s',
        new.match_id,
        new.user_id,
        v_bucket
      ),
      jsonb_build_object('deepLink', '/discover'),
      now()
    );
  -- The asker changed their mind. Told to the host alone, and only the host:
  -- they may have been holding a slot open for an answer, and the rest of the
  -- roster never heard the request in the first place.
  elsif v_was_requested and new.status = 'left' then
    select m.creator_id into v_creator_id
    from public.matches as m
    where m.id = new.match_id;

    if v_creator_id is not null and v_creator_id <> new.user_id then
      perform public.enqueue_notification(
        v_creator_id,
        'match_request_withdrawn',
        'match',
        new.match_id,
        format(
          'match_request_withdrawn:%s:%s:%s',
          new.match_id,
          new.user_id,
          v_bucket
        ),
        jsonb_build_object('deepLink', format('/match/%s', new.match_id)),
        now()
      );
    end if;
  elsif v_was_accepted and new.status in ('left', 'removed') then
    perform public.notify_match_participants(
      new.match_id,
      'match_participant_left',
      new.user_id,
      format('%s:%s:%s', new.match_id, new.user_id, v_bucket)
    );
  end if;

  return null;
end;
$$;
