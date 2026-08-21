-- The host answers a join request and the person who asked is never told.
--
-- `076` closed the first half of this flow: the host now learns that someone
-- asked to join. The answer travelled no better than the question did.
--
-- Accepted: the roster trigger fires `match_participant_joined` through
-- `notify_match_participants`, whose third argument is `p_exclude_user_id` and
-- is passed `new.user_id`. Excluding the subject is right for everyone already
-- in the match -- they do not need telling about their own join -- and exactly
-- wrong for a player promoted out of `requested`, who is the one person waiting
-- on an answer. They are now in a match, with a time and a court, and nothing
-- tells them. That is a no-show, and no-shows are the pilot's counter-metric.
--
-- Declined: `respond_to_join_request` writes `declined`, which matches no
-- branch at all -- `v_was_accepted` is false, so the `left`/`removed` branch
-- does not fire. Worse than silence: a declined row drops out of
-- `list_my_matches`, so the match disappears from the requester's list with no
-- explanation. They are left to conclude the app lost it.
--
-- Both are told to the subject alone. The rest of the roster already hears
-- about an acceptance through `match_participant_joined`, and a decline is not
-- their business.
--
-- The declined notification deep-links to discovery, not to the match:
-- `get_match_hub` refuses a declined viewer, so sending them to the hub would
-- replace a silent dead-end with a visible one.

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
