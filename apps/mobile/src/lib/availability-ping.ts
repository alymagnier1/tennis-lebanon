import {
  beirutDateKey,
  beirutLocalToUtcIso,
  utcIsoToBeirutFields,
} from "./beirut-time";
import type { AvailabilityDayPart } from "./player-availability-label";

/**
 * The day-part blocks the week is divided into.
 *
 * Named for the one-tap "I'm free" pings they were introduced for. That action
 * is gone -- it recorded intent nobody was ever notified of -- but the blocks
 * outlived it: they are how liquidity counts, Home's chips and discovery
 * overlap all agree on what "evening" means.
 *
 * Blocks match `TIME_BLOCKS` in `app/profile/availability.tsx` exactly. They have
 * to: discovery classifies an overlap into morning/afternoon/evening with the same
 * boundaries (`availabilityDayPartFromLocalTime`), so a ping written on different
 * edges would say "evening" here and something else there.
 *
 * All arithmetic goes through `beirutLocalToUtcIso`, which resolves the zone
 * offset for the specific date rather than assuming a fixed one — Beirut observes
 * DST, and that function carries a comment about the season-dependent bug that
 * came from getting this wrong.
 */

export const PING_BLOCKS: {
  part: AvailabilityDayPart;
  localStart: string;
  localEnd: string;
}[] = [
  { part: "morning", localStart: "07:00", localEnd: "12:00" },
  { part: "afternoon", localStart: "12:00", localEnd: "17:00" },
  { part: "evening", localStart: "17:00", localEnd: "22:00" },
];

export type PingSlot = {
  /** 0 = today in Beirut, 1 = tomorrow, and so on. */
  dayOffset: number;
  part: AvailabilityDayPart;
  /** Beirut calendar day the slot belongs to, `YYYY-MM-DD`. */
  dateKey: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Beirut calendar day `offset` days after the one containing `nowIso`.
 *
 * Same arithmetic as the private `addBeirutDays` in `near-term-availability.ts`.
 * It belongs in `beirut-time.ts` where both could share it, but that file has
 * unrelated changes in flight; fold the two together once it lands.
 */
export function beirutDateKeyWithOffset(
  nowIso: string,
  offset: number,
): string {
  const [year, month, day] = beirutDateKey(nowIso).split("-").map(Number);
  // Noon UTC keeps the date stable under any zone offset while adding days.
  const shifted = new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + offset, 12),
  );
  return beirutDateKey(shifted.toISOString());
}
