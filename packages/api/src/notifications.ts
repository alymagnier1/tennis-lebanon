import type { TennisSupabaseClient } from "./client";

export type UserNotificationRow = {
  id: string;
  kind: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  /** When the event became due. Always set; what the centre orders by. */
  scheduled_at: string;
  /** When push actually went out. Null while it is still in the outbox. */
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * The viewer's notification centre.
 *
 * Gated on `scheduled_at`, not `sent_at`. The old rule listed only what had
 * been pushed, which made this screen a record of successful delivery rather
 * than of things that happened — so a failed push, a stale device token or
 * notifications switched off left the centre empty too, and "open the app and
 * check" could never recover a missed message. That is the one job it has.
 *
 * `scheduled_at` rather than dropping the filter outright: reminders are
 * enqueued ahead of time, and a match reminder due tomorrow should not appear
 * today.
 */
export async function listUserNotifications(
  client: TennisSupabaseClient,
  limit = 50,
): Promise<UserNotificationRow[]> {
  const { data, error } = await client
    .from("notifications")
    .select(
      "id, kind, entity_type, entity_id, payload, scheduled_at, sent_at, read_at, created_at",
    )
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as UserNotificationRow[];
}

/**
 * How many delivered notifications the viewer has not read.
 *
 * Counted by the database rather than derived from `listUserNotifications`,
 * which pages. Filtering a page for unread answers "unread among the newest
 * N", which is the same number only until a player leaves something old
 * unread -- after that the badge quietly undercounts, or reads zero while the
 * notification centre still shows unread rows.
 *
 * Gated on `scheduled_at`, not `sent_at`, for the same reason the list is: an
 * event that happened is worth badging whether or not the push got out.
 */
export async function countUnreadNotifications(
  client: TennisSupabaseClient,
): Promise<number> {
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .lte("scheduled_at", new Date().toISOString())
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Tells the server which language to compose push copy in. The app's own locale
 * lives in device storage, which the Edge Function cannot read, so without this
 * every push falls back to English regardless of what the player chose.
 */
export async function setOwnNotificationLocale(
  client: TennisSupabaseClient,
  locale: "en" | "ar" | "fr",
): Promise<void> {
  const { error } = await (
    client.rpc as (
      name: string,
      args: Record<string, string>,
    ) => ReturnType<TennisSupabaseClient["rpc"]>
  )("set_own_notification_locale", { p_locale: locale });
  if (error) throw error;
}

export async function markNotificationRead(
  client: TennisSupabaseClient,
  notificationId: string,
): Promise<void> {
  const { error } = await (
    client.rpc as (
      name: string,
      args: Record<string, string>,
    ) => ReturnType<TennisSupabaseClient["rpc"]>
  )("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

/**
 * Mark every delivered, unread notification as read and return how many moved.
 *
 * Server side because the set is "everything of mine that is unread", which a
 * paging client can only approximate -- looping the single-row RPC over a
 * loaded page leaves anything below it unread, which the bell then correctly
 * keeps counting.
 */
export async function markAllNotificationsRead(
  client: TennisSupabaseClient,
): Promise<number> {
  const { data, error } = await client.rpc("mark_all_notifications_read");
  if (error) throw error;
  return data ?? 0;
}
