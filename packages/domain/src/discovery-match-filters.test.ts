import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCOVER_MATCH_TOGGLES,
  playerMatchesViewerFormat,
  resolveDiscoverFiltersFromProfile,
  resolveDiscoverFormatFilter,
} from "./discovery";

describe("resolveDiscoverFormatFilter", () => {
  it("returns null when format matching is off", () => {
    expect(
      resolveDiscoverFormatFilter({
        matchFormat: false,
        prefersSingles: true,
        prefersDoubles: false,
      }),
    ).toBeNull();
  });

  it("returns singles when viewer only plays singles", () => {
    expect(
      resolveDiscoverFormatFilter({
        matchFormat: true,
        prefersSingles: true,
        prefersDoubles: false,
      }),
    ).toBe("singles");
  });

  it("returns both when viewer plays singles and doubles", () => {
    expect(
      resolveDiscoverFormatFilter({
        matchFormat: true,
        prefersSingles: true,
        prefersDoubles: true,
      }),
    ).toBe("both");
  });
});

describe("resolveDiscoverFiltersFromProfile", () => {
  it("uses profile defaults when match toggles are on", () => {
    expect(
      resolveDiscoverFiltersFromProfile({
        toggles: DEFAULT_DISCOVER_MATCH_TOGGLES,
        playIntent: "social",
        prefersSingles: true,
        prefersDoubles: false,
        allZoneIds: ["zone-a"],
      }),
    ).toMatchObject({
      zoneIds: undefined,
      intent: null,
      format: null,
      requireAvailabilityOverlap: false,
      levelWindow: 1,
      applyClientFormatMatch: false,
    });
  });

  it("widens level, area, intent, format, and availability when toggles are off", () => {
    expect(
      resolveDiscoverFiltersFromProfile({
        toggles: {
          matchLevel: false,
          matchIntent: false,
          matchArea: false,
          matchFormat: false,
          matchAvailability: false,
        },
        playIntent: "competitive",
        prefersSingles: true,
        prefersDoubles: true,
        allZoneIds: ["zone-a", "zone-b"],
      }),
    ).toMatchObject({
      zoneIds: ["zone-a", "zone-b"],
      intent: null,
      format: null,
      requireAvailabilityOverlap: false,
      levelWindow: 4,
      applyClientFormatMatch: false,
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
        prefersSingles: true,
        prefersDoubles: false,
        allZoneIds: ["zone-a"],
      }),
    ).toMatchObject({
      intent: "competitive",
      format: null,
      requireAvailabilityOverlap: true,
      applyClientFormatMatch: false,
    });
  });
});

describe("playerMatchesViewerFormat", () => {
  it("matches when either shared format overlaps", () => {
    expect(
      playerMatchesViewerFormat({
        viewerPrefersSingles: true,
        viewerPrefersDoubles: true,
        candidatePrefersSingles: false,
        candidatePrefersDoubles: true,
      }),
    ).toBe(true);
  });
});
