import type { AvailabilityLiquiditySlot } from "@tennis-lebanon/api";
import { beirutDateKeyWithOffset, type PingSlot } from "./availability-ping";
import { beirutDateKey } from "./beirut-time";
import { availabilityDayPartFromUtcIso } from "./player-availability-label";

/**
 * Turning "how many players are free in each block" into something Home can show.
 *
 * A ping on its own is a diary entry: the player says they are free on Thursday
 * and nothing happens, because nobody is told. These counts are the other half —
 * they answer "is anyone else free then?", which is the question that decides
 * whether declaring a free evening was worth doing.
 *
 * A row is a `PingSlot` plus a count, deliberately: the chips and the rows then
 * share one label formatter and one already-pinged check, so the two halves of the
 * section cannot disagree about what a block is called.
 */
export type LiquidityRow = PingSlot & { playerCount: number };

/**
 * The day part comes from the block's **start**, never from its range.
 *
 * `availabilityDayPartsFromOverlap` reads both ends, and a block's end is
 * exclusive — 07:00–12:00 would come back as `["morning", "afternoon"]` because
 * 12:00 belongs to the afternoon. The start is exact, and the `PING_BLOCKS` test
 * already pins `availabilityDayPartFromLocalTime(localStart)` to each block's own
 * part, so this agrees with the chips by construction.
 */
export function toLiquidityRows(
  liquidity: AvailabilityLiquiditySlot[],
  nowIso: string,
  maxDaysAhead = 7,
): LiquidityRow[] {
  const offsetByDateKey = new Map<string, number>();
  for (let offset = 0; offset <= maxDaysAhead; offset++) {
    const dateKey = beirutDateKeyWithOffset(nowIso, offset);
    if (!offsetByDateKey.has(dateKey)) {
      offsetByDateKey.set(dateKey, offset);
    }
  }

  return liquidity.flatMap((slot) => {
    if (slot.player_count <= 0) return [];
    if (Number.isNaN(Date.parse(slot.starts_at))) return [];

    // A block outside the labelling horizon is dropped rather than shown with a
    // guessed day: there is no honest short label for "16 days out".
    const dayOffset = offsetByDateKey.get(beirutDateKey(slot.starts_at));
    if (dayOffset === undefined) return [];

    return [
      {
        dayOffset,
        part: availabilityDayPartFromUtcIso(slot.starts_at),
        dateKey: beirutDateKey(slot.starts_at),
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        playerCount: slot.player_count,
      },
    ];
  });
}

/**
 * The next few blocks in the week ahead that anyone is free for.
 *
 * A block nobody is free in is already absent — `toLiquidityRows` drops it — so
 * every block here has someone behind it.
 *
 * Ordered by **when**, not by how many. Ranking on headcount put Friday's six
 * above tomorrow's five, which reads backwards on a strip you are meant to pick
 * from: a block you could play tonight is worth more than a busier one four days
 * out, because intent decays and a court is easier to arrange for an hour people
 * are still thinking about. Count survives only as a tiebreaker between blocks
 * that start at the same moment.
 *
 * Blocks the player is already free for are deliberately **kept**. The redundancy
 * this feature had was about *asking* a question the availability grid had already
 * answered, not about showing the week's demand.
 */
export function pickUpcomingBlocks(
  rows: LiquidityRow[],
  limit = 3,
): LiquidityRow[] {
  return [...rows]
    .sort(
      (left, right) =>
        Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
        right.playerCount - left.playerCount,
    )
    .slice(0, limit);
}

/** Busiest block in the horizon — the denominator for whether this ever fires. */
export function peakLiquidity(rows: LiquidityRow[]): number {
  return rows.reduce((peak, row) => Math.max(peak, row.playerCount), 0);
}
