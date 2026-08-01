import { utcIsoToBeirutFields } from "./beirut-time";

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
