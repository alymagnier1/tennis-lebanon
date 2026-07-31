-- Milestone 8.12: stop treating "this person has no push device" as a
-- delivery failure.
--
-- Audit finding: push registration exists only in the mobile app. Club staff
-- work in the web dashboard, so they have no rows in device_push_tokens, yet
-- booking_stale_reminders enqueues the 4-hour nudge to their user ids. The
-- Edge Function then finds an empty token array and calls
-- mark_notification_failed('no_active_token'), which burns three retries over
-- fifteen minutes and finally marks the row failed.
--
-- Two things are wrong with that. Retrying a push to a device that does not
-- exist can never succeed, and a genuine delivery failure becomes
-- indistinguishable from a recipient who was never reachable by push at all.
-- The second matters most: it hides the fact that no club has ever been
-- notified of anything.
--
-- This does not make the message arrive. Reaching club staff out of band needs
-- an email or WhatsApp Business sender, which is a founder decision and is
-- recorded as a hard gate in docs/STAGING_CHECKLIST.md. What this does is stop
-- losing the signal, so the backlog is measurable and a channel added later
-- can drain it.

create or replace function public.mark_notification_unreachable(
  p_notification_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Parked immediately rather than retried: no amount of waiting will give
  -- this recipient a push token.
  update public.notifications as n
  set
    failed_at = now(),
    failure_code = 'no_delivery_channel'
  where n.id = p_notification_id
    and n.sent_at is null
    and n.failed_at is null;
end;
$$;

revoke all on function public.mark_notification_unreachable(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_notification_unreachable(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Operational visibility: how much is stranded, and for whom
-- ---------------------------------------------------------------------------

create or replace function public.unreachable_notification_summary()
returns table (
  kind text,
  recipient_count integer,
  notification_count integer,
  oldest_scheduled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_platform_operator();

  return query
  select
    n.kind,
    count(distinct n.user_id)::integer,
    count(*)::integer,
    min(n.scheduled_at)
  from public.notifications as n
  where n.failure_code = 'no_delivery_channel'
    and n.sent_at is null
  group by n.kind
  order by count(*) desc;
end;
$$;

revoke all on function public.unreachable_notification_summary() from public, anon;
grant execute on function public.unreachable_notification_summary() to authenticated;
