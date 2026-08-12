import { describe, expect, it } from "vitest";
import { openMatchSoonestSlot } from "./discovery";

describe("openMatchSoonestSlot", () => {
  it("returns the earliest starts_at slot", () => {
    const soonest = openMatchSoonestSlot([
      {
        starts_at: "2026-08-12T15:00:00.000Z",
        ends_at: "2026-08-12T16:00:00.000Z",
      },
      {
        starts_at: "2026-08-11T15:00:00.000Z",
        ends_at: "2026-08-11T16:00:00.000Z",
      },
    ]);

    expect(soonest?.starts_at).toBe("2026-08-11T15:00:00.000Z");
  });

  it("returns null for an empty list", () => {
    expect(openMatchSoonestSlot([])).toBeNull();
  });
});
