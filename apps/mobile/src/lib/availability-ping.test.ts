import { describe, expect, it } from "vitest";
import {
  beirutDateKeyWithOffset,
  isSlotAlreadyPinged,
  nextPingSlots,
  PING_BLOCKS,
} from "./availability-ping";
import { availabilityDayPartFromLocalTime } from "./player-availability-label";
import { utcIsoToBeirutFields } from "./beirut-time";

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

describe("isSlotAlreadyPinged", () => {
  const slot = {
    startsAt: "2026-08-17T14:00:00.000Z",
    endsAt: "2026-08-17T19:00:00.000Z",
  };

  it("detects an exact match", () => {
    expect(
      isSlotAlreadyPinged(slot, [
        { starts_at: slot.startsAt, ends_at: slot.endsAt },
      ]),
    ).toBe(true);
  });

  it("detects a partial overlap, matching the RPC's dedupe rule", () => {
    expect(
      isSlotAlreadyPinged(slot, [
        {
          starts_at: "2026-08-17T18:00:00.000Z",
          ends_at: "2026-08-17T21:00:00.000Z",
        },
      ]),
    ).toBe(true);
  });

  it("treats a touching boundary as not overlapping", () => {
    // A window ending exactly when the slot starts is a different block.
    expect(
      isSlotAlreadyPinged(slot, [
        {
          starts_at: "2026-08-17T09:00:00.000Z",
          ends_at: "2026-08-17T14:00:00.000Z",
        },
      ]),
    ).toBe(false);
  });

  it("ignores recurring windows, which carry no timestamps", () => {
    expect(
      isSlotAlreadyPinged(slot, [{ starts_at: null, ends_at: null }]),
    ).toBe(false);
  });

  it("is false against an empty list", () => {
    expect(isSlotAlreadyPinged(slot, [])).toBe(false);
  });
});
