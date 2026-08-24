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

  if (sorted.length === DAY_PART_ORDER.length) {
    return t("availability.blocks.allDay");
  }

  const labels = sorted.map((part) => t(`availability.blocks.${part}`));
  if (labels.length === 1) return labels[0]!;
  return t("playerProfile.availabilityPartsTwo", {
    first: labels[0],
    second: labels[1],
  });
}

export function weekdayShortLabels(weekdays: number[], t: TFunction): string[] {
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((weekday) => t(`availability.weekdaysShort.${weekday}`));
}

/** Compact weekly list for the profile fact row: "Sat", "Fri & Sat", "Sun, Fri & Sat". */
export function formatWeeklyDaysLabel(
  weekdays: number[],
  t: TFunction,
): string {
  const days = weekdayShortLabels(weekdays, t);
  if (days.length === 0) return "";
  if (days.length === 1) return days[0]!;
  if (days.length === 2) {
    return t("playerProfile.weeklyDaysTwo", {
      first: days[0],
      second: days[1],
    });
  }
  return t("playerProfile.weeklyDaysMany", {
    list: days.slice(0, -1).join(", "),
    last: days[days.length - 1],
  });
}

/** Ultra-short weekday chips for Discover cards (M, T, Th, …). */
export function weekdayCompactLabels(
  weekdays: number[],
  t: TFunction,
): string[] {
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((weekday) => t(`availability.weekdaysCompact.${weekday}`));
}

/** Per-weekday blocks for profile chips; falls back when RPC omits `by_weekday`. */
export function publicAvailabilityByWeekday(
  summary: PublicPlayerAvailabilitySummary | undefined,
): Array<{ weekday: number; day_parts: AvailabilityDayPart[] }> {
  if (!summary) return [];

  if (summary.by_weekday.length > 0) {
    return [...summary.by_weekday]
      .sort((a, b) => a.weekday - b.weekday)
      .map((entry) => ({
        weekday: entry.weekday,
        day_parts: sortAvailabilityDayParts(entry.day_parts),
      }));
  }

  return [...summary.weekdays]
    .sort((a, b) => a - b)
    .map((weekday) => ({
      weekday,
      day_parts: sortAvailabilityDayParts(summary.day_parts),
    }));
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

  const blocks = formatAvailabilityDayPartsLabel(sortedParts, t);
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
