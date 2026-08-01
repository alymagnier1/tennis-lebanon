import type { TennisSupabaseClient } from "./client";

export type UserNotificationRow = {
  id: string;
  kind: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listUserNotifications(
  client: TennisSupabaseClient,
  limit = 50,
): Promise<UserNotificationRow[]> {
  const { data, error } = await client
    .from("notifications")
    .select(
      "id, kind, entity_type, entity_id, payload, sent_at, read_at, created_at",
    )
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as UserNotificationRow[];
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
