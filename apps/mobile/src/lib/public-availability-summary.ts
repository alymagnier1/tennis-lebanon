import type { PublicPlayerAvailabilitySummary } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";
import type { AvailabilityDayPart } from "./player-availability-label";

const DAY_PART_ORDER: AvailabilityDayPart[] = [
  "morning",
  "afternoon",
  "evening",
];

export function sortAvailabilityDayParts(
  parts: AvailabilityDayPart[],
): AvailabilityDayPart[] {
  return DAY_PART_ORDER.filter((part) => parts.includes(part));
}

export function formatAvailabilityDayPartsLabel(
  parts: AvailabilityDayPart[],
  t: TFunction,
): string {
  const sorted = sortAvailabilityDayParts(parts);
  if (sorted.length === 0) return "";

  const labels = sorted.map((part) => t(`availability.blocks.${part}`));
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) {
    return t("playerProfile.availabilityPartsTwo", {
      first: labels[0],
      second: labels[1],
    });
  }
  return t("playerProfile.availabilityPartsMany", {
    first: labels.slice(0, -1).join(", "),
    last: labels[labels.length - 1],
  });
}

export function weekdayShortLabels(weekdays: number[], t: TFunction): string[] {
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((weekday) => t(`availability.weekdaysShort.${weekday}`));
}

export function hasPublicAvailabilitySummary(
  summary: PublicPlayerAvailabilitySummary | undefined,
): boolean {
  if (!summary) return false;
  return summary.weekdays.length > 0 || summary.day_parts.length > 0;
}

/** Compact recurring schedule for discovery cards when overlap is absent. */
export function formatDiscoverPlayerAvailabilityLabel(
  weekdays: number[],
  dayParts: AvailabilityDayPart[],
  t: TFunction,
): string | null {
  const sortedParts = sortAvailabilityDayParts(dayParts);
  if (sortedParts.length === 0) return null;

  // Three weekdays spelled out against all three blocks is the one combination
  // that overruns the card's single line, and it describes the most available
  // players — the ones worth surfacing. "All day" is both shorter and plainer
  // than enumerating every block. The profile keeps the explicit breakdown.
  const blocks =
    sortedParts.length === DAY_PART_ORDER.length
      ? t("availability.blocks.allDay")
      : formatAvailabilityDayPartsLabel(sortedParts, t);
  const days = weekdayShortLabels(weekdays, t);

  if (days.length === 0) {
    return blocks;
  }

  if (days.length <= 3) {
    // Composed here rather than through a translation key. Both halves are
    // already translated, so the key would be pure interpolation and identical
    // across locales, which the locale parity guard rejects.
    return `${days.join(", ")} · ${blocks}`;
  }

  return t("discover.playerAvailabilityManyDays", {
    count: days.length,
    blocks,
  });
}
