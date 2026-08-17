import { beirutDateKey, beirutLocalToUtcIso } from "./beirut-time";
import type { AvailabilityDayPart } from "./player-availability-label";

/**
 * The one-tap "I'm free" slots offered on Home.
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

/**
 * The next `limit` blocks a player could still turn up for, starting from now.
 *
 * A block whose end has already passed in Beirut is skipped rather than shown
 * greyed out: offering "this morning" at 6pm invites a tap that the RPC would
 * then reject for being out of range.
 */
export function nextPingSlots(
  nowIso: string,
  limit = 4,
  maxDaysAhead = 7,
): PingSlot[] {
  const slots: PingSlot[] = [];
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    return slots;
  }

  for (
    let offset = 0;
    offset <= maxDaysAhead && slots.length < limit;
    offset++
  ) {
    const dateKey = beirutDateKeyWithOffset(nowIso, offset);

    for (const block of PING_BLOCKS) {
      if (slots.length >= limit) break;

      const startsAt = beirutLocalToUtcIso(dateKey, block.localStart);
      const endsAt = beirutLocalToUtcIso(dateKey, block.localEnd);

      // Judged on the end, not the start: at 18:00 the evening block is still
      // worth pinging even though it began an hour ago.
      if (Date.parse(endsAt) <= nowMs) {
        continue;
      }

      slots.push({
        dayOffset: offset,
        part: block.part,
        dateKey,
        startsAt,
        endsAt,
      });
    }
  }

  return slots;
}

/** True when an existing one-off window already covers this slot. */
export function isSlotAlreadyPinged(
  slot: Pick<PingSlot, "startsAt" | "endsAt">,
  windows: { starts_at: string | null; ends_at: string | null }[],
): boolean {
  const start = Date.parse(slot.startsAt);
  const end = Date.parse(slot.endsAt);

  return windows.some((window) => {
    if (!window.starts_at || !window.ends_at) return false;
    const windowStart = Date.parse(window.starts_at);
    const windowEnd = Date.parse(window.ends_at);
    // Same overlap rule the RPC dedupes on, so the UI and the database agree
    // about which chips are already covered.
    return windowStart < end && windowEnd > start;
  });
}
