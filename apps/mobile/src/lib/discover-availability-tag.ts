import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";
import { formatNearTermAvailabilitySlots } from "./near-term-availability";

export function discoverPlayerAvailabilityTag(
  player: CompatiblePlayerCard,
  showOverlap: boolean,
  t: TFunction,
  now: Date = new Date(),
): string | null {
  const slots = showOverlap
    ? player.near_term_overlap_slots
    : player.near_term_slots;

  return formatNearTermAvailabilitySlots(slots, t, now);
}
