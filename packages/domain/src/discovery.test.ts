import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEVEL_WINDOW,
  discoveryFiltersForMatchInvite,
  expandRecurringAvailability,
  hasMinimumOverlap,
  isWithinLevelWindow,
  recurringWindowFromTimes,
  skillBandRank,
  widenLevelWindow,
  widenDiscoveryZoneIds,
} from "./discovery";

describe("discovery domain rules", () => {
  it("orders skill bands consistently", () => {
    expect(skillBandRank("beginner")).toBeLessThan(
      skillBandRank("competitive"),
    );
  });

  it("checks level windows", () => {
    expect(isWithinLevelWindow("intermediate", "advanced", 1)).toBe(true);
    expect(isWithinLevelWindow("beginner", "competitive", 1)).toBe(false);
  });

  it("widens the level window once", () => {
    expect(widenLevelWindow(DEFAULT_LEVEL_WINDOW)).toBe(2);
    expect(widenLevelWindow(2)).toBe(2);
  });

  it("widens discovery zones to all active zones", () => {
    const zones = [
      "aaaaaaaa-0001-0001-0001-000000000001",
      "aaaaaaaa-0001-0001-0001-000000000002",
    ];
    expect(widenDiscoveryZoneIds(zones)).toEqual(zones);
  });

  it("requires at least 60 minutes of overlap", () => {
    const base = new Date("2026-07-25T10:00:00.000Z");
    const short = new Date("2026-07-25T10:30:00.000Z");
    const long = new Date("2026-07-25T11:30:00.000Z");

    expect(
      hasMinimumOverlap(
        { startsAt: base, endsAt: long },
        { startsAt: base, endsAt: short },
      ),
    ).toBe(false);
    expect(
      hasMinimumOverlap(
        { startsAt: base, endsAt: long },
        { startsAt: base, endsAt: long },
      ),
    ).toBe(true);
  });

  it("expands recurring availability inside the horizon", () => {
    const windows = [
      recurringWindowFromTimes({
        weekday: 5,
        localStart: "18:00",
        localEnd: "21:00",
      }),
    ];
    const rangeStart = new Date("2026-07-24T00:00:00.000Z");
    const rangeEnd = new Date("2026-08-07T00:00:00.000Z");
    const expanded = expandRecurringAvailability(windows, rangeStart, rangeEnd);
    expect(expanded.length).toBeGreaterThan(0);
  });

  it("maps match invite filters without over-tightening intent", () => {
    expect(
      discoveryFiltersForMatchInvite({
        format: "singles",
        intent: "either",
      }),
    ).toEqual({
      format: "singles",
      intent: undefined,
      requireAvailabilityOverlap: true,
      levelWindow: DEFAULT_LEVEL_WINDOW,
      horizonDays: 14,
      limit: 20,
    });

    expect(
      discoveryFiltersForMatchInvite({
        format: "doubles",
        intent: "social",
      }).intent,
    ).toBe("social");
  });
});
