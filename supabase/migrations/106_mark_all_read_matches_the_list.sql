-- "Mark all read" could not clear a notification the device never received.
--
-- 083 marked delivered rows only -- `sent_at is not null` -- on the reasoning
-- that a row still in the outbox "has not reached anyone, and marking it read
-- would hide it before it was ever shown".
--
-- The read side never agreed. `listUserNotifications` and
-- `countUnreadNotifications` both gate on `scheduled_at`, deliberately: an
-- event that happened is worth showing whether or not the push got out. So the
-- centre listed rows, and the bell counted them, that this function refused to
-- touch. Tapping one still cleared it -- `mark_notification_read` carries no
-- such guard -- but "Mark all read" silently moved nothing and returned 0.
--
-- On staging that is every row: 107 notifications, 0 delivered, because no
-- device has ever registered a push token. The badge had no way down.
--
-- The harm 083 guarded against does not exist in this pipeline.
-- `claim_due_notifications` selects on `scheduled_at` and `sent_at is null`
-- and never reads `read_at`, so a row marked read is still pushed when due.
--
-- Match the read side exactly: everything of mine that is due and unread.
-- Due rather than unfiltered, so a reminder scheduled for tomorrow -- which the
-- player cannot see yet, in the centre or on the bell -- is not cleared before
-- it ever arrives.

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_marked integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  with updated as (
    update public.notifications as n
    set read_at = now()
    where n.user_id = v_user_id
      and n.read_at is null
      and n.scheduled_at <= now()
    returning 1
  )
  select count(*)::integer into v_marked from updated;

  return v_marked;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;
