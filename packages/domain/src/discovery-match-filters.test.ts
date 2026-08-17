import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCOVER_MATCH_TOGGLES,
  MAX_LEVEL_WINDOW,
  resolveDiscoverFiltersFromProfile,
} from "./discovery";

describe("resolveDiscoverFiltersFromProfile", () => {
  it("does not restrict by area out of the box", () => {
    expect(
      resolveDiscoverFiltersFromProfile({
        toggles: DEFAULT_DISCOVER_MATCH_TOGGLES,
        playIntent: "social",
        ownZoneIds: ["zone-a"],
      }),
    ).toMatchObject({
      zoneIds: undefined,
      intent: null,
      format: null,
      requireAvailabilityOverlap: false,
      levelWindow: 1,
    });
  });

  it("restricts to the player's own areas when the Area toggle is on", () => {
    // Every toggle narrows when true. This one used to map `true` to `undefined`,
    // which `discover_compatible_players` reads as "no zone filter" — and the one
    // caller fed it every zone in the country, so the `false` branch restricted to
    // all of them and matched everyone too. The chip filtered nothing either way.
    expect(
      resolveDiscoverFiltersFromProfile({
        toggles: { ...DEFAULT_DISCOVER_MATCH_TOGGLES, matchArea: true },
        playIntent: "social",
        ownZoneIds: ["zone-a", "zone-b"],
      }).zoneIds,
    ).toEqual(["zone-a", "zone-b"]);
  });

  it("widens level, area, intent, and availability when toggles are off", () => {
    expect(
      resolveDiscoverFiltersFromProfile({
        toggles: {
          matchLevel: false,
          matchIntent: false,
          matchArea: false,
          matchAvailability: false,
        },
        playIntent: "competitive",
        ownZoneIds: ["zone-a", "zone-b"],
      }),
    ).toMatchObject({
      zoneIds: undefined,
      intent: null,
      format: null,
      requireAvailabilityOverlap: false,
      levelWindow: 4,
    });
  });

  it("leaves nothing restricted when every toggle is cleared", () => {
    // This is exactly what "Show everyone" does on the empty state. It used to add
    // a zone filter, so the one button whose whole purpose was to widen the search
    // made it narrower — the worst possible behaviour in a quiet area.
    const relaxed = resolveDiscoverFiltersFromProfile({
      toggles: {
        matchLevel: false,
        matchIntent: false,
        matchArea: false,
        matchAvailability: false,
      },
      playIntent: "competitive",
      ownZoneIds: ["zone-a"],
    });

    expect(relaxed.zoneIds).toBeUndefined();
    expect(relaxed.intent).toBeNull();
    expect(relaxed.requireAvailabilityOverlap).toBe(false);
    expect(relaxed.levelWindow).toBe(MAX_LEVEL_WINDOW);
  });

  it("cannot restrict a player who has set no areas", () => {
    expect(
      resolveDiscoverFiltersFromProfile({
        toggles: { ...DEFAULT_DISCOVER_MATCH_TOGGLES, matchArea: true },
        playIntent: "social",
        ownZoneIds: [],
      }).zoneIds,
    ).toBeUndefined();
  });

  it("applies profile intent and availability when those toggles are on", () => {
    expect(
      resolveDiscoverFiltersFromProfile({
        toggles: {
          ...DEFAULT_DISCOVER_MATCH_TOGGLES,
          matchIntent: true,
          matchAvailability: true,
        },
        playIntent: "competitive",
        ownZoneIds: ["zone-a"],
      }),
    ).toMatchObject({
      intent: "competitive",
      format: null,
      requireAvailabilityOverlap: true,
    });
  });
});
