import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";
import { formatNearTermAvailabilitySlots } from "./near-term-availability";
import { formatDiscoverPlayerAvailabilityLabel } from "./public-availability-summary";

export function discoverPlayerAvailabilityTag(
  player: CompatiblePlayerCard,
  showOverlap: boolean,
  t: TFunction,
  now: Date = new Date(),
): string | null {
  const slots = showOverlap
    ? player.near_term_overlap_slots
    : player.near_term_slots;

  const nearTerm = formatNearTermAvailabilitySlots(slots, t, now);
  if (nearTerm) {
    return nearTerm;
  }

  // Discovery matches across the full horizon while these chips only cover the
  // next three days, so a player can legitimately reach the card with nothing
  // to show here. Falling through to their usual pattern keeps the card from
  // reading as "never plays"; the habitual framing stops it being mistaken for
  // a concrete upcoming slot, and the exact grid lives on their profile.
  const usual = formatDiscoverPlayerAvailabilityLabel(
    player.availability_weekdays,
    player.availability_day_parts,
    t,
  );

  return usual ? t("discover.usualAvailability", { schedule: usual }) : null;
}
