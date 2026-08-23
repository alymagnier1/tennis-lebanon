import { describe, expect, it } from "vitest";
import {
  peakLiquidity,
  pickUpcomingBlocks,
  toLiquidityRows,
  type LiquidityRow,
} from "./availability-liquidity";
import { PING_BLOCKS } from "./availability-ping";
import { beirutLocalToUtcIso } from "./beirut-time";

/** A block as the RPC returns it, built from Beirut wall clock like the SQL does. */
function slot(dateKey: string, part: string, playerCount: number) {
  const block = PING_BLOCKS.find((candidate) => candidate.part === part)!;
  return {
    starts_at: beirutLocalToUtcIso(dateKey, block.localStart),
    ends_at: beirutLocalToUtcIso(dateKey, block.localEnd),
    player_count: playerCount,
  };
}

const NOW = "2026-08-17T05:00:00.000Z"; // 08:00 Beirut, a Monday

describe("toLiquidityRows", () => {
  it("labels every block with the part the chips use", () => {
    // The regression this guards: deriving the part from the range would read the
    // exclusive end, so 07:00-12:00 would come back as afternoon and the busiest
    // morning of the week would be advertised as an afternoon.
    const rows = toLiquidityRows(
      [
        slot("2026-08-17", "morning", 2),
        slot("2026-08-17", "afternoon", 3),
        slot("2026-08-17", "evening", 4),
      ],
      NOW,
    );

    expect(rows.map((row) => row.part)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("resolves the Beirut day into an offset from today", () => {
    const rows = toLiquidityRows(
      [
        slot("2026-08-17", "evening", 1),
        slot("2026-08-18", "evening", 1),
        slot("2026-08-20", "evening", 1),
      ],
      NOW,
    );

    expect(rows.map((row) => row.dayOffset)).toEqual([0, 1, 3]);
  });

  it("drops blocks nobody is free in", () => {
    const rows = toLiquidityRows(
      [slot("2026-08-17", "evening", 0), slot("2026-08-18", "evening", 2)],
      NOW,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.dayOffset).toBe(1);
  });

  it("drops a block past the labelling horizon rather than guessing a day", () => {
    const rows = toLiquidityRows([slot("2026-09-30", "evening", 9)], NOW);
    expect(rows).toEqual([]);
  });

  it("survives an unparseable timestamp", () => {
    const rows = toLiquidityRows(
      [{ starts_at: "not-a-date", ends_at: "not-a-date", player_count: 3 }],
      NOW,
    );

    expect(rows).toEqual([]);
  });

  it("labels the same wall clock correctly in both seasons", () => {
    // Beirut is UTC+3 in August and UTC+2 in January, so these are different
    // instants for the same block. A fixed offset would misfile one of them.
    const summer = toLiquidityRows([slot("2026-08-17", "evening", 1)], NOW);
    const winter = toLiquidityRows(
      [slot("2027-01-15", "evening", 1)],
      "2027-01-15T05:00:00.000Z",
    );

    expect(summer[0]?.part).toBe("evening");
    expect(winter[0]?.part).toBe("evening");
    expect(summer[0]?.startsAt.slice(11, 16)).toBe("14:00");
    expect(winter[0]?.startsAt.slice(11, 16)).toBe("15:00");
  });
});

describe("pickUpcomingBlocks", () => {
  it("ranks the soonest block first, not the busiest", () => {
    // The block you could play tonight beats a busier one four days out: intent
    // decays, and a court is easier to arrange for an hour people are still
    // thinking about.
    const rows = toLiquidityRows(
      [
        slot("2026-08-17", "morning", 2),
        slot("2026-08-20", "evening", 6),
        slot("2026-08-22", "morning", 4),
      ],
      NOW,
    );

    expect(
      pickUpcomingBlocks(rows, 3).map((row) => [
        row.dayOffset,
        row.part,
        row.playerCount,
      ]),
    ).toEqual([
      [0, "morning", 2],
      [3, "evening", 6],
      [5, "morning", 4],
    ]);
  });

  it("breaks a tie on time by taking the busier block", () => {
    const tied = toLiquidityRows(
      [slot("2026-08-19", "evening", 3), slot("2026-08-19", "evening", 7)],
      NOW,
    );

    expect(pickUpcomingBlocks(tied, 2)[0]).toMatchObject({
      playerCount: 7,
    });
  });

  it("honours the limit", () => {
    const rows = toLiquidityRows(
      [
        slot("2026-08-18", "evening", 1),
        slot("2026-08-19", "evening", 2),
        slot("2026-08-20", "evening", 3),
      ],
      NOW,
    );

    expect(pickUpcomingBlocks(rows, 2)).toHaveLength(2);
  });

  it("is empty when no block has anyone free", () => {
    // toLiquidityRows already drops zero counts, so an empty week reaches here as
    // an empty list — and the section renders nothing rather than a dead heading.
    expect(
      pickUpcomingBlocks(
        toLiquidityRows([slot("2026-08-18", "evening", 0)], NOW),
      ),
    ).toEqual([]);
  });

  it("does not reorder the caller's array", () => {
    const rows = toLiquidityRows(
      [slot("2026-08-18", "evening", 1), slot("2026-08-20", "evening", 9)],
      NOW,
    );
    const before = rows.map((row) => row.startsAt);

    pickUpcomingBlocks(rows, 2);
    expect(rows.map((row) => row.startsAt)).toEqual(before);
  });
});

describe("peakLiquidity", () => {
  it("reports the busiest block", () => {
    const rows = toLiquidityRows(
      [slot("2026-08-18", "evening", 3), slot("2026-08-20", "morning", 7)],
      NOW,
    );

    expect(peakLiquidity(rows)).toBe(7);
  });

  it("is zero with nothing to show", () => {
    expect(peakLiquidity([] as LiquidityRow[])).toBe(0);
  });
});
