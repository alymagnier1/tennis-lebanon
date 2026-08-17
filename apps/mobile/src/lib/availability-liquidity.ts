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
 * The busiest blocks that the chips are not already offering.
 *
 * Chips cover the next few blocks and carry their own count, so repeating one as a
 * row would show the same number twice with two different affordances. What is
 * left is the part the chips cannot reach: the peak later in the week, which is
 * the whole point of looking at seven days.
 *
 * Ranked by count first, not by soonest — "Thursday is when everyone plays" is the
 * insight; the soonest block is already a chip.
 */
export function pickLiquidityHighlights(
  rows: LiquidityRow[],
  chips: PingSlot[],
  limit = 2,
): LiquidityRow[] {
  const chipStarts = new Set(chips.map((chip) => Date.parse(chip.startsAt)));

  return rows
    .filter((row) => !chipStarts.has(Date.parse(row.startsAt)))
    .sort(
      (left, right) =>
        right.playerCount - left.playerCount ||
        Date.parse(left.startsAt) - Date.parse(right.startsAt),
    )
    .slice(0, limit);
}

/**
 * Players free in this chip's block, or 0 when nobody is.
 *
 * Matched on the parsed instant, not the string: the RPC and `beirutLocalToUtcIso`
 * can render the same moment as `...+00:00` and `...000Z`, and a chip must not
 * lose its count to a formatting difference.
 */
export function liquidityCountForSlot(
  slot: Pick<PingSlot, "startsAt">,
  rows: LiquidityRow[],
): number {
  const startMs = Date.parse(slot.startsAt);

  return (
    rows.find((row) => Date.parse(row.startsAt) === startMs)?.playerCount ?? 0
  );
}

/** Busiest block in the horizon — the denominator for whether this ever fires. */
export function peakLiquidity(rows: LiquidityRow[]): number {
  return rows.reduce((peak, row) => Math.max(peak, row.playerCount), 0);
}
