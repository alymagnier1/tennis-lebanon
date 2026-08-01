import type { TFunction } from "i18next";
import { utcIsoToBeirutFields, weekdayIndexInBeirut } from "./beirut-time";

export type AvailabilityDayPart = "morning" | "afternoon" | "evening";

/** Matches `TIME_BLOCKS` in profile availability (Asia/Beirut). */
export function availabilityDayPartFromLocalTime(
  time: string,
): AvailabilityDayPart {
  const hour = Number(time.split(":")[0] ?? 0);

  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  if (hour < 7) return "morning";
  return "evening";
}

export function availabilityDayPartFromUtcIso(
  iso: string,
): AvailabilityDayPart {
  return availabilityDayPartFromLocalTime(utcIsoToBeirutFields(iso).time);
}

export function availabilityDayPartsFromOverlap(
  startsAt: string,
  endsAt: string,
): AvailabilityDayPart[] {
  const startPart = availabilityDayPartFromUtcIso(startsAt);
  const endPart = availabilityDayPartFromUtcIso(endsAt);
  if (startPart === endPart) return [startPart];
  return [startPart, endPart];
}

function formatOverlapBlockLabels(
  parts: AvailabilityDayPart[],
  t: TFunction,
): string {
  const labels = [...new Set(parts)].map((part) =>
    t(`availability.blocks.${part}`),
  );

  if (labels.length === 1) {
    return labels[0]!;
  }

  return t("playerProfile.availabilityPartsTwo", {
    first: labels[0],
    second: labels[1],
  });
}

/** Shared overlap for discovery cards: "Fri · Evening". */
export function formatOverlapAvailabilityLabel(
  startsAt: string,
  endsAt: string,
  t: TFunction,
): string {
  const weekday = t(
    `availability.weekdaysShort.${weekdayIndexInBeirut(startsAt)}`,
  );
  const blocks = formatOverlapBlockLabels(
    availabilityDayPartsFromOverlap(startsAt, endsAt),
    t,
  );

  return t("discover.overlapAvailability", { weekday, blocks });
}
