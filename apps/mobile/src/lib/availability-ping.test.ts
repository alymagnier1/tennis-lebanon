import { describe, expect, it } from "vitest";
import {
  beirutDateKeyWithOffset,
  findSlotCoverage,
  nextPingSlots,
  PING_BLOCKS,
} from "./availability-ping";
import { availabilityDayPartFromLocalTime } from "./player-availability-label";
import { beirutLocalToUtcIso, utcIsoToBeirutFields } from "./beirut-time";

describe("PING_BLOCKS", () => {
  it("agrees with how discovery classifies a time", () => {
    // If these drift, a ping written as "evening" is read as something else by
    // the overlap code, and the two halves of the feature disagree.
    for (const block of PING_BLOCKS) {
      expect(availabilityDayPartFromLocalTime(block.localStart)).toBe(
        block.part,
      );
    }
  });
});

describe("beirutDateKeyWithOffset", () => {
  it("advances the Beirut calendar day", () => {
    const now = "2026-08-17T09:00:00.000Z";
    expect(beirutDateKeyWithOffset(now, 0)).toBe("2026-08-17");
    expect(beirutDateKeyWithOffset(now, 1)).toBe("2026-08-18");
    expect(beirutDateKeyWithOffset(now, 7)).toBe("2026-08-24");
  });

  it("rolls over month and year boundaries", () => {
    expect(beirutDateKeyWithOffset("2026-08-31T09:00:00.000Z", 1)).toBe(
      "2026-09-01",
    );
    expect(beirutDateKeyWithOffset("2026-12-31T09:00:00.000Z", 1)).toBe(
      "2027-01-01",
    );
  });

  it("uses the Beirut day, not the UTC day", () => {
    // 22:30 UTC is already the next day in Beirut (UTC+3 in summer).
    expect(beirutDateKeyWithOffset("2026-08-17T22:30:00.000Z", 0)).toBe(
      "2026-08-18",
    );
  });
});

describe("nextPingSlots", () => {
  it("skips blocks that have already finished today", () => {
    // 18:00 Beirut in summer (UTC+3) is 15:00Z. Morning and afternoon are gone.
    const slots = nextPingSlots("2026-08-17T15:00:00.000Z", 4);

    expect(slots[0]).toMatchObject({ dayOffset: 0, part: "evening" });
    expect(slots.slice(1).every((slot) => slot.dayOffset >= 1)).toBe(true);
  });

  it("offers all three of today's blocks early in the morning", () => {
    // 05:00Z is 08:00 Beirut — morning is under way but not over.
    const slots = nextPingSlots("2026-08-17T05:00:00.000Z", 3);

    expect(slots.map((slot) => slot.part)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
    expect(slots.every((slot) => slot.dayOffset === 0)).toBe(true);
  });

  it("rolls onto the next day once every block today has ended", () => {
    // 19:30Z is 22:30 Beirut — still the 17th, but the evening block ended at
    // 22:00, so nothing remains today.
    const slots = nextPingSlots("2026-08-17T19:30:00.000Z", 2);

    expect(slots[0]).toMatchObject({ dayOffset: 1, part: "morning" });
    expect(slots[0]?.dateKey).toBe("2026-08-18");
  });

  it("treats past midnight in Beirut as the new day at offset 0", () => {
    // 21:00Z is 00:00 on the 18th in Beirut, so "today" is already the 18th and
    // its morning is the next thing available — not an offset-1 slot.
    const slots = nextPingSlots("2026-08-17T21:00:00.000Z", 1);

    expect(slots[0]).toMatchObject({ dayOffset: 0, part: "morning" });
    expect(slots[0]?.dateKey).toBe("2026-08-18");
  });

  it("returns slots whose end is always in the future", () => {
    const now = "2026-08-17T15:00:00.000Z";
    for (const slot of nextPingSlots(now, 6)) {
      expect(Date.parse(slot.endsAt)).toBeGreaterThan(Date.parse(now));
    }
  });

  it("honours the limit and stays inside the horizon", () => {
    const slots = nextPingSlots("2026-08-17T05:00:00.000Z", 5, 2);
    expect(slots).toHaveLength(5);
    expect(Math.max(...slots.map((s) => s.dayOffset))).toBeLessThanOrEqual(2);
  });

  it("maps each slot to the right Beirut wall clock", () => {
    const evening = nextPingSlots("2026-08-17T05:00:00.000Z", 3)[2]!;
    expect(evening.part).toBe("evening");
    expect(utcIsoToBeirutFields(evening.startsAt).time).toBe("17:00");
    expect(utcIsoToBeirutFields(evening.endsAt).time).toBe("22:00");
  });

  it("still maps correctly outside summer time", () => {
    // January: Beirut is UTC+2 rather than UTC+3, so a fixed offset would put
    // this an hour out. The stored instants differ between the seasons even
    // though the wall clock does not, which is the whole point.
    const winter = nextPingSlots("2027-01-15T05:00:00.000Z", 3).find(
      (slot) => slot.part === "evening",
    )!;
    const summer = nextPingSlots("2026-08-17T05:00:00.000Z", 3).find(
      (slot) => slot.part === "evening",
    )!;

    expect(utcIsoToBeirutFields(winter.startsAt).time).toBe("17:00");
    expect(utcIsoToBeirutFields(summer.startsAt).time).toBe("17:00");
    expect(winter.startsAt.slice(11, 16)).toBe("15:00");
    expect(summer.startsAt.slice(11, 16)).toBe("14:00");
  });

  it("returns nothing for an unparseable clock rather than throwing", () => {
    expect(nextPingSlots("not-a-date")).toEqual([]);
  });
});

describe("findSlotCoverage", () => {
  // Monday 17 Aug 2026, evening block: 17:00-22:00 Beirut.
  const slot = {
    startsAt: beirutLocalToUtcIso("2026-08-17", "17:00"),
    endsAt: beirutLocalToUtcIso("2026-08-17", "22:00"),
    dateKey: "2026-08-17",
  };
  const MONDAY = 1;

  function oneOff(startsAt: string, endsAt: string, id = "one-off") {
    return {
      id,
      is_recurring: false,
      starts_at: startsAt,
      ends_at: endsAt,
      weekday: null,
      local_start: null,
      local_end: null,
      valid_from: null,
      valid_until: null,
    };
  }

  function recurring(
    weekday: number,
    localStart: string,
    localEnd: string,
    extra: { valid_from?: string; valid_until?: string } = {},
  ) {
    return {
      id: "recurring",
      is_recurring: true,
      starts_at: null,
      ends_at: null,
      weekday,
      local_start: localStart,
      local_end: localEnd,
      valid_from: extra.valid_from ?? null,
      valid_until: extra.valid_until ?? null,
    };
  }

  it("finds an exact one-off match", () => {
    expect(
      findSlotCoverage(slot, MONDAY, [oneOff(slot.startsAt, slot.endsAt)]),
    ).toMatchObject({ kind: "one_off" });
  });

  it("finds a partial one-off overlap, matching the RPC's dedupe rule", () => {
    expect(
      findSlotCoverage(slot, MONDAY, [
        oneOff(
          beirutLocalToUtcIso("2026-08-17", "20:00"),
          beirutLocalToUtcIso("2026-08-17", "23:00"),
        ),
      ]),
    ).toMatchObject({ kind: "one_off" });
  });

  it("treats a touching boundary as not overlapping", () => {
    // A window ending exactly when the block starts is a different block.
    expect(
      findSlotCoverage(slot, MONDAY, [
        oneOff(
          beirutLocalToUtcIso("2026-08-17", "12:00"),
          beirutLocalToUtcIso("2026-08-17", "17:00"),
        ),
      ]),
    ).toBeNull();
  });

  it("finds a recurring window on the same weekday", () => {
    // The bug this replaces: recurring windows were skipped because they carry no
    // timestamps, so a player whose grid said "free Monday evenings" was still
    // asked to declare it, and the tap wrote a duplicate.
    expect(
      findSlotCoverage(slot, MONDAY, [
        recurring(MONDAY, "17:00:00", "22:00:00"),
      ]),
    ).toMatchObject({ kind: "recurring" });
  });

  it("ignores a recurring window on another weekday", () => {
    expect(
      findSlotCoverage(slot, MONDAY, [recurring(2, "17:00:00", "22:00:00")]),
    ).toBeNull();
  });

  it("ignores a recurring window whose hours do not reach the block", () => {
    expect(
      findSlotCoverage(slot, MONDAY, [
        recurring(MONDAY, "07:00:00", "12:00:00"),
      ]),
    ).toBeNull();
  });

  it("counts a recurring window that only partly overlaps the block", () => {
    expect(
      findSlotCoverage(slot, MONDAY, [
        recurring(MONDAY, "12:00:00", "18:00:00"),
      ]),
    ).toMatchObject({ kind: "recurring" });
  });

  it("respects the validity window on a recurring entry", () => {
    expect(
      findSlotCoverage(slot, MONDAY, [
        recurring(MONDAY, "17:00:00", "22:00:00", {
          valid_from: "2026-09-01",
        }),
      ]),
    ).toBeNull();
    expect(
      findSlotCoverage(slot, MONDAY, [
        recurring(MONDAY, "17:00:00", "22:00:00", {
          valid_until: "2026-08-01",
        }),
      ]),
    ).toBeNull();
    expect(
      findSlotCoverage(slot, MONDAY, [
        recurring(MONDAY, "17:00:00", "22:00:00", {
          valid_from: "2026-08-01",
          valid_until: "2026-08-31",
        }),
      ]),
    ).toMatchObject({ kind: "recurring" });
  });

  it("returns the window itself, so a ping can be told from a grid entry", () => {
    // Only a one-off is the caller's to delete; removing a grid entry from Home
    // would quietly rewrite the player's usual week.
    const coverage = findSlotCoverage(slot, MONDAY, [
      oneOff(slot.startsAt, slot.endsAt, "window-42"),
    ]);

    expect(coverage?.window.id).toBe("window-42");
  });

  it("is null against an empty list", () => {
    expect(findSlotCoverage(slot, MONDAY, [])).toBeNull();
  });
});
