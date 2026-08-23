import { describe, expect, it } from "vitest";
import { beirutDateKeyWithOffset, PING_BLOCKS } from "./availability-ping";
import { availabilityDayPartFromLocalTime } from "./player-availability-label";

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
