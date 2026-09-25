import { describe, expect, it } from "vitest";
import { beirutLocalToUtcIso } from "./beirut-time";
import { slotWindowUtc } from "./slot-window";

describe("slotWindowUtc", () => {
  it("starts at the Beirut wall-clock time and lasts the duration", () => {
    const window = slotWindowUtc({
      day: "2030-01-15",
      startTime: "18:00",
      duration: 90,
    });

    expect(window.startsAt).toBe(beirutLocalToUtcIso("2030-01-15", "18:00"));
    expect(
      new Date(window.endsAt).getTime() - new Date(window.startsAt).getTime(),
    ).toBe(90 * 60_000);
  });

  it("ends on the next day when the match runs past midnight", () => {
    const window = slotWindowUtc({
      day: "2030-01-15",
      startTime: "23:30",
      duration: 90,
    });

    expect(new Date(window.endsAt).getTime()).toBeGreaterThan(
      new Date(window.startsAt).getTime(),
    );
    expect(window.endsAt).toBe(beirutLocalToUtcIso("2030-01-16", "01:00"));
  });

  it("keeps the length across a daylight-saving change", () => {
    // Lebanon moves clocks on the last Sunday of March.
    const window = slotWindowUtc({
      day: "2030-03-31",
      startTime: "01:00",
      duration: 120,
    });

    expect(
      new Date(window.endsAt).getTime() - new Date(window.startsAt).getTime(),
    ).toBe(120 * 60_000);
  });
});
