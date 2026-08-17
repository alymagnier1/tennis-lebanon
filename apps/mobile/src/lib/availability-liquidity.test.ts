import { describe, expect, it } from "vitest";
import {
  liquidityCountForSlot,
  peakLiquidity,
  pickLiquidityHighlights,
  toLiquidityRows,
  type LiquidityRow,
} from "./availability-liquidity";
import { nextPingSlots, PING_BLOCKS } from "./availability-ping";
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

describe("pickLiquidityHighlights", () => {
  const rows = toLiquidityRows(
    [
      slot("2026-08-17", "morning", 2),
      slot("2026-08-20", "evening", 6),
      slot("2026-08-22", "morning", 4),
    ],
    NOW,
  );

  it("leaves out blocks a chip already offers", () => {
    // At 08:00 the first chip is this morning, which carries its own count.
    const chips = nextPingSlots(NOW, 1);
    expect(chips[0]).toMatchObject({ dayOffset: 0, part: "morning" });

    const highlights = pickLiquidityHighlights(rows, chips, 5);
    expect(
      highlights.some((row) => row.dayOffset === 0 && row.part === "morning"),
    ).toBe(false);
    expect(highlights).toHaveLength(2);
  });

  it("ranks the busiest block first, not the soonest", () => {
    const highlights = pickLiquidityHighlights(rows, [], 3);
    expect(highlights.map((row) => row.playerCount)).toEqual([6, 4, 2]);
  });

  it("breaks a tie on count by taking the sooner block", () => {
    const tied = toLiquidityRows(
      [slot("2026-08-22", "evening", 3), slot("2026-08-19", "evening", 3)],
      NOW,
    );

    expect(pickLiquidityHighlights(tied, [], 2)[0]?.dayOffset).toBe(2);
  });

  it("honours the limit", () => {
    expect(pickLiquidityHighlights(rows, [], 1)).toHaveLength(1);
  });

  it("does not reorder the caller's array", () => {
    const before = rows.map((row) => row.startsAt);
    pickLiquidityHighlights(rows, [], 3);
    expect(rows.map((row) => row.startsAt)).toEqual(before);
  });
});

describe("liquidityCountForSlot", () => {
  const rows = toLiquidityRows([slot("2026-08-17", "evening", 5)], NOW);

  it("finds the count for a chip's own block", () => {
    const evening = nextPingSlots(NOW, 3).find(
      (candidate) => candidate.part === "evening",
    )!;

    expect(liquidityCountForSlot(evening, rows)).toBe(5);
  });

  it("matches on the instant, not the string form", () => {
    // The RPC and beirutLocalToUtcIso can format the same instant differently;
    // the chip's count must not disappear because of a trailing-zeros mismatch.
    expect(
      liquidityCountForSlot({ startsAt: "2026-08-17T14:00:00+00:00" }, rows),
    ).toBe(5);
  });

  it("returns zero when nobody is free in that block", () => {
    const morning = nextPingSlots(NOW, 1)[0]!;
    expect(liquidityCountForSlot(morning, rows)).toBe(0);
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
