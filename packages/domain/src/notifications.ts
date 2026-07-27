export const NOTIFICATION_KINDS = [
  "match_invitation",
  "stale_match_reminder",
  "match_expired",
  "booking_pending_club",
  "booking_stale_participant",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationPayload = {
  deepLink?: string;
  title?: string;
  body?: string;
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
  const title = typeof record.title === "string" ? record.title.trim() : undefined;
  const body = typeof record.body === "string" ? record.body.trim() : undefined;

  if (!deepLink && !title && !body) {
    return null;
  }

  return { deepLink, title, body };
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

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: {
    deepLink: string;
    kind: string;
  };
};

export function buildExpoPushMessages(input: {
  kind: string;
  payload: NotificationPayload;
  tokens: string[];
}): ExpoPushMessage[] {
  const deepLink = normalizeNotificationDeepLink(input.payload.deepLink) ?? "/";
  const title = input.payload.title ?? "Tennis Lebanon";
  const body = input.payload.body ?? "Open the app for an update.";

  return input.tokens.map((token) => ({
    to: token,
    title,
    body,
    data: {
      deepLink,
      kind: input.kind,
    },
  }));
}
