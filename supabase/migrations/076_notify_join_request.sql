-- A request to join an approval-required match told nobody.
--
-- `join_match` writes a `requested` participant row and `get_match_hub` returns
-- it under `pending_requests`, where the hub already renders accept and decline
-- buttons. All of that works. What never happened was telling the host it was
-- there: the roster trigger from `061` fires on `accepted` and on `left`/
-- `removed`, and has no branch for `requested`. So the host got no push, no
-- notification row and no badge, and could only find the request by opening that
-- specific match's hub and scrolling to it. Meanwhile the requester saw the
-- match in their own list and reasonably assumed they were in.
--
-- Notified to the **creator alone**, not through `notify_match_participants`.
-- Only the host can accept or decline, and telling the rest of the roster that
-- someone has asked to join publishes a decision the host has not made yet.
--
-- Same 15-minute dedup bucket as the other roster events, so a player who
-- requests, is declined and requests again in quick succession collapses to one
-- notification rather than pinging the host repeatedly.

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
