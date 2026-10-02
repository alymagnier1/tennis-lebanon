import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";
import { nearTermAvailabilityWeekdays } from "./near-term-availability";
import { sortAvailabilityDayParts } from "./public-availability-summary";

/** Up to this many days read as "Thu · Fri"; more fall back to "M · T · Th". */
const SHORT_DAY_NAME_LIMIT = 3;

function dayLabels(weekdays: number[], t: TFunction): string[] {
  const style =
    weekdays.length <= SHORT_DAY_NAME_LIMIT
      ? "weekdaysShort"
      : "weekdaysCompact";
  return weekdays.map((weekday) => t(`availability.${style}.${weekday}`));
}

/**
 * Weekday labels for Discover player cards — one per day, never a
 * comma-joined string. Spelled out ("Thu") when there are few enough to fit
 * the card's line, compact ("Th") otherwise.
 */
export function discoverPlayerAvailabilityTags(
  player: CompatiblePlayerCard,
  showOverlap: boolean,
  t: TFunction,
): string[] {
  const slots = showOverlap
    ? player.near_term_overlap_slots
    : player.near_term_slots;

  const nearTermDays = nearTermAvailabilityWeekdays(slots);
  if (nearTermDays.length > 0) {
    return dayLabels(nearTermDays, t);
  }

  // Discovery matches across the full horizon while these chips only cover the
  // next three days, so a player can legitimately reach the card with nothing
  // to show here. Falling through to their usual weekdays keeps the card from
  // reading as "never plays"; the exact grid lives on their profile.
  const hasDayParts =
    sortAvailabilityDayParts(player.availability_day_parts).length > 0;
  if (!hasDayParts || player.availability_weekdays.length === 0) {
    return [];
  }

  return dayLabels(
    [...player.availability_weekdays].sort((a, b) => a - b),
    t,
  );
}

/**
 * The card's availability line: the days alone beside the clock icon
 * ("Thu · Fri"), and the full sentence for screen readers
 * ("Available Thu · Fri"). Null with no days.
 */
export function discoverPlayerAvailabilityLine(
  player: CompatiblePlayerCard,
  showOverlap: boolean,
  t: TFunction,
): { text: string; accessibilityLabel: string } | null {
  const days = discoverPlayerAvailabilityTags(player, showOverlap, t);
  if (days.length === 0) return null;
  const text = days.join(" · ");
  return {
    text,
    accessibilityLabel: t("discover.availableOn", { days: text }),
  };
}
