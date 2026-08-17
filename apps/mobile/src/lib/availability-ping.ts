import {
  beirutDateKey,
  beirutLocalToUtcIso,
  utcIsoToBeirutFields,
} from "./beirut-time";
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

/** The shape of an `availability_windows` row that coverage needs to read. */
export type AvailabilityWindowLike = {
  id: string;
  is_recurring: boolean;
  starts_at: string | null;
  ends_at: string | null;
  weekday: number | null;
  local_start: string | null;
  local_end: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

export type SlotCoverage = {
  window: AvailabilityWindowLike;
  /** `recurring` came from the availability grid and is not ours to delete. */
  kind: "recurring" | "one_off";
};

function minutesOfDay(localTime: string): number {
  // Postgres `time` arrives as HH:MM:SS; the blocks are written as HH:MM.
  const [hours, minutes] = localTime.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * The window that already makes the player free for this block, if any.
 *
 * Reads the **recurring** grid as well as one-off pings. Checking only one-off
 * windows was the original mistake: someone whose profile said "free Wednesday
 * mornings" was still offered a chip to declare exactly that, and tapping it
 * stored the same availability a second time. Three of the first six real taps
 * were duplicates of the tapper's own grid.
 *
 * Returns the window rather than a boolean so the caller can tell a ping it may
 * remove from a grid entry it must not touch behind the player's back.
 */
export function findSlotCoverage(
  slot: Pick<PingSlot, "startsAt" | "endsAt" | "dateKey">,
  weekday: number,
  windows: AvailabilityWindowLike[],
): SlotCoverage | null {
  const start = Date.parse(slot.startsAt);
  const end = Date.parse(slot.endsAt);
  const blockStart = minutesOfDay(utcIsoToBeirutFields(slot.startsAt).time);
  const blockEnd = minutesOfDay(utcIsoToBeirutFields(slot.endsAt).time);

  for (const window of windows) {
    if (window.is_recurring) {
      if (
        window.weekday !== weekday ||
        !window.local_start ||
        !window.local_end
      ) {
        continue;
      }
      if (window.valid_from && slot.dateKey < window.valid_from) continue;
      if (window.valid_until && slot.dateKey > window.valid_until) continue;

      if (
        minutesOfDay(window.local_start) < blockEnd &&
        minutesOfDay(window.local_end) > blockStart
      ) {
        return { window, kind: "recurring" };
      }
      continue;
    }

    if (!window.starts_at || !window.ends_at) continue;
    // Same overlap rule the RPC dedupes on, so the UI and the database agree
    // about which blocks are already covered.
    if (
      Date.parse(window.starts_at) < end &&
      Date.parse(window.ends_at) > start
    ) {
      return { window, kind: "one_off" };
    }
  }

  return null;
}
