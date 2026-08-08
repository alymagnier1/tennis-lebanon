import { describe, expect, it } from "vitest";
import {
  favoriteClubIdsFromDirectory,
  seedFavoriteClubIds,
  seedZoneIdsFromProfile,
  shouldSeedFavoriteClubs,
  whereSectionHydrated,
} from "./schedule-prefill";

describe("seedZoneIdsFromProfile", () => {
  it("prefills from profile when draft is empty", () => {
    expect(
      seedZoneIdsFromProfile(undefined, ["z1", "z2"], ["z1", "z2", "z3"]),
    ).toEqual(["z1", "z2"]);
  });

  it("keeps draft zones that are still active", () => {
    expect(seedZoneIdsFromProfile(["z2"], ["z1"], ["z1", "z2"])).toEqual([
      "z2",
    ]);
  });

  it("drops inactive zones from profile prefill", () => {
    expect(seedZoneIdsFromProfile(undefined, ["z-old"], ["z1"])).toEqual([]);
  });
});

describe("seedFavoriteClubIds", () => {
  it("prefills favourites capped at three", () => {
    expect(seedFavoriteClubIds(undefined, ["c1", "c2", "c3", "c4"])).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });

  it("respects an existing draft selection", () => {
    expect(seedFavoriteClubIds(["c9"], ["c1"])).toEqual(["c9"]);
  });
});

describe("favoriteClubIdsFromDirectory", () => {
  it("returns only favourite clubs", () => {
    expect(
      favoriteClubIdsFromDirectory([
        { club_id: "c1", is_favorite: true },
        { club_id: "c2", is_favorite: false },
      ]),
    ).toEqual(["c1"]);
  });
});

describe("whereSectionHydrated", () => {
  it("waits for zones before deciding", () => {
    expect(
      whereSectionHydrated({
        zonesHydrated: false,
        clubsHydrated: true,
        clubsSettled: true,
      }),
    ).toBe(false);
  });

  it("waits for the club directory before deciding", () => {
    expect(
      whereSectionHydrated({
        zonesHydrated: true,
        clubsHydrated: false,
        clubsSettled: false,
      }),
    ).toBe(false);
  });

  it("is ready once seeding has run", () => {
    expect(
      whereSectionHydrated({
        zonesHydrated: true,
        clubsHydrated: true,
        clubsSettled: false,
      }),
    ).toBe(true);
  });

  it("is ready once the directory settles even with nothing to seed", () => {
    expect(
      whereSectionHydrated({
        zonesHydrated: true,
        clubsHydrated: false,
        clubsSettled: true,
      }),
    ).toBe(true);
  });
});

describe("shouldSeedFavoriteClubs", () => {
  it("seeds for a host with no favourites yet", () => {
    expect(
      shouldSeedFavoriteClubs([
        { club_id: "c1", is_favorite: false },
        { club_id: "c2", is_favorite: false },
      ]),
    ).toBe(true);
  });

  it("leaves a curated favourites list alone", () => {
    expect(
      shouldSeedFavoriteClubs([
        { club_id: "c1", is_favorite: true },
        { club_id: "c2", is_favorite: false },
      ]),
    ).toBe(false);
  });

  it("seeds when the directory has not loaded", () => {
    expect(shouldSeedFavoriteClubs(undefined)).toBe(true);
  });
});
