import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCOVER_MATCH_TOGGLES,
  resolveDiscoverFiltersFromProfile,
} from "./discovery";

describe("resolveDiscoverFiltersFromProfile", () => {
  it("uses profile defaults when match toggles are on", () => {
    expect(
      resolveDiscoverFiltersFromProfile({
        toggles: DEFAULT_DISCOVER_MATCH_TOGGLES,
        playIntent: "social",
        allZoneIds: ["zone-a"],
      }),
    ).toMatchObject({
      zoneIds: undefined,
      intent: null,
      format: null,
      requireAvailabilityOverlap: false,
      levelWindow: 1,
    });
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
        allZoneIds: ["zone-a", "zone-b"],
      }),
    ).toMatchObject({
      zoneIds: ["zone-a", "zone-b"],
      intent: null,
      format: null,
      requireAvailabilityOverlap: false,
      levelWindow: 4,
    });
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
        allZoneIds: ["zone-a"],
      }),
    ).toMatchObject({
      intent: "competitive",
      format: null,
      requireAvailabilityOverlap: true,
    });
  });
});
