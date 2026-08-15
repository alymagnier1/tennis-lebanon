import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";
import { formatNearTermAvailabilityDayChips } from "./near-term-availability";
import {
  sortAvailabilityDayParts,
  weekdayCompactLabels,
} from "./public-availability-summary";

/**
 * Compact weekday chips for Discover player cards — one chip per day
 * (e.g. M, T, Th), never a comma-joined string.
 */
export function discoverPlayerAvailabilityTags(
  player: CompatiblePlayerCard,
  showOverlap: boolean,
  t: TFunction,
): string[] {
  const slots = showOverlap
    ? player.near_term_overlap_slots
    : player.near_term_slots;

  const nearTerm = formatNearTermAvailabilityDayChips(slots, t);
  if (nearTerm.length > 0) {
    return nearTerm;
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

  return weekdayCompactLabels(player.availability_weekdays, t);
}
