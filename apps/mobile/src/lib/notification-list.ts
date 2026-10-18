import type { NotificationKind } from "@tennis-lebanon/domain";
import { beirutDateKey } from "./beirut-time";
import type { IconName } from "../components/Icon";

/**
 * How the notification centre lays rows out: grouped by Beirut day, newest
 * first, each with an icon and a tone that says what kind of news it is.
 * Kept out of the screen so it can be tested without rendering.
 */

/** "today" / "yesterday" / a weekday this week / an older date. */
export type NotificationDayLabel =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "weekday"; dateKey: string }
  | { kind: "date"; dateKey: string };

export type NotificationDayGroup<Row> = {
  dateKey: string;
  label: NotificationDayLabel;
  rows: Row[];
};

type DatedRow = { scheduled_at: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(laterKey: string, earlierKey: string): number {
  return Math.round(
    (Date.parse(`${laterKey}T00:00:00Z`) -
      Date.parse(`${earlierKey}T00:00:00Z`)) /
      DAY_MS,
  );
}

export function notificationDayLabel(
  dateKey: string,
  todayKey: string,
): NotificationDayLabel {
  const age = daysBetween(todayKey, dateKey);
  if (age <= 0) return { kind: "today" };
  if (age === 1) return { kind: "yesterday" };
  if (age < 7) return { kind: "weekday", dateKey };
  return { kind: "date", dateKey };
}

/**
 * Groups rows by the Beirut day they happened, newest day first and newest
 * row first within a day. `scheduled_at` is the moment the event happened, so
 * it is both the sort key and the time shown on the card.
 */
export function groupNotificationsByDay<Row extends DatedRow>(
  rows: readonly Row[],
  nowIso: string,
): NotificationDayGroup<Row>[] {
  const todayKey = beirutDateKey(nowIso);
  const sorted = [...rows].sort(
    (a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at),
  );

  const groups: NotificationDayGroup<Row>[] = [];
  for (const row of sorted) {
    const dateKey = beirutDateKey(row.scheduled_at);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === dateKey) {
      last.rows.push(row);
    } else {
      groups.push({
        dateKey,
        label: notificationDayLabel(dateKey, todayKey),
        rows: [row],
      });
    }
  }
  return groups;
}

/**
 * - `action`: waiting on the reader (answer an invite, confirm a score).
 * - `good`: something went their way (accepted, court booked, player joined).
 * - `setback`: something fell through (cancelled, expired, removed).
 * - `info`: everything else.
 */
export type NotificationTone = "action" | "good" | "setback" | "info";

export type NotificationLook = { icon: IconName; tone: NotificationTone };

const LOOKS: Record<NotificationKind, NotificationLook> = {
  match_invitation: { icon: "players", tone: "action" },
  match_join_request: { icon: "players", tone: "action" },
  match_played_prompt: { icon: "calendar", tone: "action" },
  attendance_prompt: { icon: "calendar", tone: "action" },
  match_played_confirmed: { icon: "star", tone: "action" },
  result_confirm_request: { icon: "star", tone: "action" },
  stale_match_reminder: { icon: "clock", tone: "action" },
  booking_stale_participant: { icon: "court", tone: "action" },
  court_first_roster_short: { icon: "players", tone: "action" },

  match_request_accepted: { icon: "checkMark", tone: "good" },
  match_participant_joined: { icon: "players", tone: "good" },
  match_court_confirmed: { icon: "court", tone: "good" },
  match_seat_reopened: { icon: "players", tone: "good" },
  result_auto_confirmed: { icon: "star", tone: "good" },

  match_cancelled: { icon: "close", tone: "setback" },
  match_expired: { icon: "clock", tone: "setback" },
  match_participant_removed: { icon: "close", tone: "setback" },
  match_request_declined: { icon: "close", tone: "setback" },
  match_court_released: { icon: "court", tone: "setback" },
  match_participant_left: { icon: "players", tone: "setback" },
  match_invitation_superseded: { icon: "players", tone: "setback" },

  match_message: { icon: "chat", tone: "info" },
  match_time_changed: { icon: "calendar", tone: "info" },
  booking_pending_club: { icon: "court", tone: "info" },
  match_request_withdrawn: { icon: "players", tone: "info" },
};

const UNKNOWN_LOOK: NotificationLook = { icon: "notifications", tone: "info" };

export function notificationLook(kind: string): NotificationLook {
  return (
    (LOOKS as Record<string, NotificationLook | undefined>)[kind] ??
    UNKNOWN_LOOK
  );
}
