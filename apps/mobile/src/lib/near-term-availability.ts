import type { NearTermAvailabilitySlot } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";
import { beirutDateKey } from "./beirut-time";
import {
  availabilityDayPartsFromOverlap,
  type AvailabilityDayPart,
} from "./player-availability-label";
import { sortAvailabilityDayParts } from "./public-availability-summary";

const DAY_PART_ORDER: AvailabilityDayPart[] = [
  "morning",
  "afternoon",
  "evening",
];

function mergeDayParts(
  left: AvailabilityDayPart[],
  right: AvailabilityDayPart[],
): AvailabilityDayPart[] {
  return DAY_PART_ORDER.filter(
    (part) => left.includes(part) || right.includes(part),
  );
}

function formatBlockLabels(parts: AvailabilityDayPart[], t: TFunction): string {
  const sorted = sortAvailabilityDayParts(parts);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) {
    return t(`availability.blocks.${sorted[0]}`);
  }
  if (sorted.length === 2) {
    return t("playerProfile.availabilityPartsTwo", {
      first: t(`availability.blocks.${sorted[0]}`),
      second: t(`availability.blocks.${sorted[1]}`),
    });
  }
  return t("playerProfile.availabilityPartsMany", {
    first: sorted
      .slice(0, -1)
      .map((part) => t(`availability.blocks.${part}`))
      .join(", "),
    last: t(`availability.blocks.${sorted[sorted.length - 1]}`),
  });
}

function addBeirutDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days, 12),
  );
  return beirutDateKey(next.toISOString());
}

function formatNearTermDayLabel(
  dateKey: string,
  now: Date,
  t: TFunction,
): string {
  const todayKey = beirutDateKey(now.toISOString());
  const tomorrowKey = addBeirutDays(todayKey, 1);

  if (dateKey === todayKey) {
    return t("discover.today");
  }
  if (dateKey === tomorrowKey) {
    return t("discover.tomorrow");
  }

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00Z`));
  const indices: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return t(`availability.weekdaysShort.${indices[weekday] ?? 0}`);
}

function groupSlotsByDay(
  slots: NearTermAvailabilitySlot[],
): Array<{ dateKey: string; parts: AvailabilityDayPart[] }> {
  const grouped = new Map<string, AvailabilityDayPart[]>();

  for (const slot of slots) {
    const dateKey = beirutDateKey(slot.starts_at);
    const parts = availabilityDayPartsFromOverlap(slot.starts_at, slot.ends_at);
    const existing = grouped.get(dateKey) ?? [];
    const merged = parts.reduce(
      (accumulated, part) => mergeDayParts(accumulated, [part]),
      existing,
    );
    grouped.set(dateKey, merged);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, parts]) => ({ dateKey, parts }));
}

/** Compact label for today + next two days, e.g. "Today · Evening, Sat · Morning". */
export function formatNearTermAvailabilitySlots(
  slots: NearTermAvailabilitySlot[],
  t: TFunction,
  now: Date = new Date(),
): string | null {
  const grouped = groupSlotsByDay(slots);
  if (grouped.length === 0) {
    return null;
  }

  // Composed here rather than through a translation key. Both halves are
  // already translated, so the key would be pure interpolation and identical
  // across locales, which the locale parity guard rejects.
  const labels = grouped.map(
    ({ dateKey, parts }) =>
      `${formatNearTermDayLabel(dateKey, now, t)} · ${formatBlockLabels(parts, t)}`,
  );

  return labels.join(", ");
}
