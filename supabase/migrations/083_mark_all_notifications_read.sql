-- "Mark all read" only marked what the screen had loaded.
--
-- `notifications.tsx` listed 20 rows and looped `mark_notification_read` over
-- the unread ones in that page. While the bell badge was itself derived from
-- the same page, the two agreed -- both meant "among the newest 20" -- and the
-- badge reached zero. Counting unread properly makes the gap visible: mark all
-- read, and the badge stays lit on rows the loop never reached.
--
-- Marking is the database's job here. The set to update is "everything of mine
-- that is unread", which the client can only approximate by paging.
--
-- Delivered only, matching `mark_notification_read` and the centre's own list:
-- a notification still in the outbox has not reached anyone, and marking it
-- read would hide it before it was ever shown.

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
      and n.sent_at is not null
    returning 1
  )
  select count(*)::integer into v_marked from updated;

  return v_marked;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;
