/**
 * Every kind the database can enqueue. Six of these were missing for a long
 * time, which is why they rendered only by accident: the client fell through to
 * the English `title`/`body` the SQL happened to put in the payload. A kind
 * absent from this list is not localizable, so adding an `enqueue_notification`
 * call site means adding it here and to `notifications.kinds.*` in
 * `packages/i18n` and `supabase/functions/_shared/notification-copy.ts`.
 */
export const NOTIFICATION_KINDS = [
  "match_invitation",
  "stale_match_reminder",
  "match_expired",
  "match_cancelled",
  "booking_pending_club",
  "booking_stale_participant",
  "attendance_prompt",
  "match_time_changed",
  "match_court_confirmed",
  "match_court_released",
  "court_first_roster_short",
  "match_played_prompt",
  "match_played_confirmed",
  "match_join_request",
  "match_request_accepted",
  "match_request_declined",
  "match_request_withdrawn",
  "match_participant_joined",
  "match_participant_left",
  "match_message",
  "result_confirm_request",
  "result_auto_confirmed",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * Values interpolated into localized copy. Kept structured rather than
 * pre-formatted so each surface can render them in the recipient's language and
 * timezone: `startsAt` is a UTC ISO timestamp, displayed in `Asia/Beirut`.
 */
export type NotificationParams = {
  /** Inviter or other person named in the copy (e.g. match_invitation). */
  name?: string;
  clubName?: string;
  startsAt?: string;
  spotsLeft?: number;
};

export type NotificationPayload = {
  deepLink?: string;
  title?: string;
  body?: string;
  params?: NotificationParams;
};

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export function parseNotificationPayload(
  value: unknown,
): NotificationPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const deepLink =
    typeof record.deepLink === "string" ? record.deepLink.trim() : undefined;
  const title =
    typeof record.title === "string" ? record.title.trim() : undefined;
  const body = typeof record.body === "string" ? record.body.trim() : undefined;
  const params = parseNotificationParams(record.params);

  if (!deepLink && !title && !body) {
    return null;
  }

  return { deepLink, title, body, params };
}

function parseNotificationParams(
  value: unknown,
): NotificationParams | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : undefined;
  const clubName =
    typeof record.clubName === "string" ? record.clubName.trim() : undefined;
  const startsAt =
    typeof record.startsAt === "string" ? record.startsAt.trim() : undefined;
  const spotsLeft =
    typeof record.spotsLeft === "number" ? record.spotsLeft : undefined;

  if (
    name === undefined &&
    clubName === undefined &&
    startsAt === undefined &&
    spotsLeft === undefined
  ) {
    return undefined;
  }

  return { name, clubName, startsAt, spotsLeft };
}

export function normalizeNotificationDeepLink(
  deepLink: string | null | undefined,
): string | null {
  const trimmed = deepLink?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("tennislebanon://")) {
    const path = trimmed.replace("tennislebanon://", "/");
    return path.startsWith("/") ? path : `/${path}`;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

// `buildExpoPushMessages` used to be mirrored here from
// `supabase/functions/_shared/notifications.ts`. Nothing in the app ever called
// it — only its own test did — and once push copy became locale-aware the two
// diverged, leaving a copy that composed English-only messages and looked
// authoritative. Removed rather than re-synced: the Edge Function is the only
// place push messages are actually built.
