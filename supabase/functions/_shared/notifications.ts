import {
  interpolateNotificationCopy,
  NOTIFICATION_COPY,
  normalizeNotificationLocale,
  type NotificationLocale,
} from "./notification-copy.ts";

export type NotificationParams = {
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

function parseParams(value: unknown): NotificationParams | undefined {
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
  const params = parseParams(record.params);

  if (!deepLink && !title && !body) {
    return null;
  }

  return { deepLink, title, body, params };
}

function normalizeNotificationDeepLink(
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

const LOCALE_TAGS: Record<NotificationLocale, string> = {
  // Lebanon writes dates day-first, so plain "en" (which Node/Deno resolve to
  // US ordering) would render the wrong shape for an English-speaking user here.
  en: "en-GB",
  ar: "ar-LB",
  fr: "fr-FR",
};

/** Stored UTC, displayed in Beirut — the rule from CLAUDE.md, applied per locale. */
function formatStartsAt(iso: string, locale: NotificationLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    timeZone: "Asia/Beirut",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function displayParams(
  params: NotificationParams | undefined,
  locale: NotificationLocale,
): Record<string, string | number | undefined> | undefined {
  if (!params) {
    return undefined;
  }

  return {
    name: params.name,
    clubName: params.clubName,
    startsAt: params.startsAt
      ? formatStartsAt(params.startsAt, locale)
      : undefined,
    spotsLeft: params.spotsLeft,
  };
}

export type ResolvedNotificationCopy = {
  title: string;
  body: string;
};

/**
 * Picks the copy a recipient actually sees.
 *
 * The SQL literals in the payload used to win unconditionally, which is why
 * every notification was English regardless of the reader's language. They are
 * now the fallback, used only when this kind has no catalogue entry — an older
 * database enqueuing a kind this deploy has not been taught yet.
 */
export function resolveNotificationCopy(input: {
  kind: string;
  locale: string | null | undefined;
  payload: NotificationPayload;
}): ResolvedNotificationCopy {
  const locale = normalizeNotificationLocale(input.locale);
  const entry =
    NOTIFICATION_COPY[locale]?.[input.kind] ?? NOTIFICATION_COPY.en[input.kind];

  const fallbackTitle = input.payload.title ?? "Tennis Lebanon";
  const fallbackBody = input.payload.body ?? "Open the app for an update.";

  if (!entry) {
    return { title: fallbackTitle, body: fallbackBody };
  }

  const params = displayParams(input.payload.params, locale);
  const title = interpolateNotificationCopy(entry.title, params);
  const body = interpolateNotificationCopy(entry.body, params);

  // A template whose placeholders were not all filled means the enqueue site
  // did not send `params`. Showing "{{clubName}}" to a player is worse than
  // showing correct English, so fall back rather than ship the raw template.
  if (title.includes("{{") || body.includes("{{")) {
    return { title: fallbackTitle, body: fallbackBody };
  }

  return { title, body };
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
  locale?: string | null;
}): ExpoPushMessage[] {
  const deepLink = normalizeNotificationDeepLink(input.payload.deepLink) ?? "/";
  const { title, body } = resolveNotificationCopy({
    kind: input.kind,
    locale: input.locale,
    payload: input.payload,
  });

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
