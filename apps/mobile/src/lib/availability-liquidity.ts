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
 * The busiest few blocks in the week ahead.
 *
 * Ranked by how many others are free, then by soonest — "Thursday is when everyone
 * plays" is the insight, and a block nobody is free in is already absent, because
 * `toLiquidityRows` drops it. Under a heading that reports where the demand is,
 * there is nothing honest to say about an empty block.
 *
 * Blocks the player is already free for are deliberately **kept**. The redundancy
 * this feature had was about *asking* a question the availability grid had already
 * answered, not about showing the week's demand: "Friday evening, four free, and so
 * are you" is worth knowing. The caller decides whether a row is a prompt or a
 * statement by looking up the player's own coverage.
 */
export function pickBusiestBlocks(
  rows: LiquidityRow[],
  limit = 3,
): LiquidityRow[] {
  return [...rows]
    .sort(
      (left, right) =>
        right.playerCount - left.playerCount ||
        Date.parse(left.startsAt) - Date.parse(right.startsAt),
    )
    .slice(0, limit);
}

/** Busiest block in the horizon — the denominator for whether this ever fires. */
export function peakLiquidity(rows: LiquidityRow[]): number {
  return rows.reduce((peak, row) => Math.max(peak, row.playerCount), 0);
}
