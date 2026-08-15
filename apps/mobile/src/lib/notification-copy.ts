import { isNotificationKind } from "@tennis-lebanon/domain";
import { formatUtcInBeirut } from "./beirut-time";

export type NotificationCopyInput = {
  kind: string;
  payload: Record<string, unknown> | null | undefined;
};

export type NotificationCopy = {
  title: string;
  body: string;
};

type Translate = (key: string, params?: Record<string, unknown>) => string;

function readParams(
  payload: Record<string, unknown> | null | undefined,
): Record<string, string | number> | undefined {
  const raw = payload?.params;
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  const out: Record<string, string | number> = {};

  if (typeof record.clubName === "string") {
    out.clubName = record.clubName;
  }
  if (typeof record.startsAt === "string") {
    // Stored UTC, shown in Beirut. i18next receives the display string, so the
    // same template works for every locale without date logic in the copy.
    out.startsAt = formatUtcInBeirut(record.startsAt);
  }
  if (typeof record.spotsLeft === "number") {
    out.spotsLeft = record.spotsLeft;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Resolves what a notification row reads as.
 *
 * The payload's `title`/`body` used to win unconditionally, so the translated
 * `notifications.kinds.*` strings were never rendered and every reader got
 * English. Now a known kind is translated, and the payload is consulted only
 * for a kind this build does not recognise — an app older than the database.
 */
export function resolveNotificationCopy(
  input: NotificationCopyInput,
  t: Translate,
): NotificationCopy {
  const payload = input.payload ?? {};
  const payloadTitle =
    typeof payload.title === "string" ? payload.title : undefined;
  const payloadBody =
    typeof payload.body === "string" ? payload.body : undefined;

  if (!isNotificationKind(input.kind)) {
    return {
      title: payloadTitle ?? t("notifications.fallbackTitle"),
      body: payloadBody ?? t("notifications.fallbackBody"),
    };
  }

  const params = readParams(payload);
  const title = t(`notifications.kinds.${input.kind}.title`, params);
  const body = t(`notifications.kinds.${input.kind}.body`, params);

  // An unfilled placeholder means the enqueue site sent no `params`. Correct
  // English beats showing a reader "{{clubName}}".
  if (title.includes("{{") || body.includes("{{")) {
    return {
      title: payloadTitle ?? title,
      body: payloadBody ?? body,
    };
  }

  return { title, body };
}
