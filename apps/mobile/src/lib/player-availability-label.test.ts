import { describe, expect, it } from "vitest";
import {
  availabilityDayPartFromLocalTime,
  availabilityDayPartsFromOverlap,
} from "./player-availability-label";

describe("availabilityDayPartFromLocalTime", () => {
  it("maps hours to morning, afternoon, and evening blocks", () => {
    expect(availabilityDayPartFromLocalTime("08:30")).toBe("morning");
    expect(availabilityDayPartFromLocalTime("14:00")).toBe("afternoon");
    expect(availabilityDayPartFromLocalTime("19:15")).toBe("evening");
  });
});

describe("availabilityDayPartsFromOverlap", () => {
  it("returns one part when overlap stays in the same block", () => {
    expect(
      availabilityDayPartsFromOverlap(
        "2026-08-01T05:00:00.000Z",
        "2026-08-01T06:30:00.000Z",
      ),
    ).toEqual(["morning"]);
  });
});
