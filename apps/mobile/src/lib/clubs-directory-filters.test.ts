import { describe, expect, it } from "vitest";
import { filterClubsDirectory } from "./clubs-directory-filters";

const clubs = [
  {
    name: "Hoops Tennis",
    amenities: ["parking", "showers"],
    zone: "Beirut",
  },
  {
    name: "Mountain Club",
    amenities: ["pay_as_you_play"],
    zone: "Metn",
  },
];

const zoneLabel = (club: (typeof clubs)[number]) => club.zone;

describe("filterClubsDirectory", () => {
  it("returns every club when search is empty", () => {
    expect(filterClubsDirectory(clubs, "  ", zoneLabel)).toEqual(clubs);
  });

  it("matches name, zone, or a humanized amenity", () => {
    expect(
      filterClubsDirectory(clubs, "hoops", zoneLabel).map((c) => c.name),
    ).toEqual(["Hoops Tennis"]);
    expect(
      filterClubsDirectory(clubs, "metn", zoneLabel).map((c) => c.name),
    ).toEqual(["Mountain Club"]);
    expect(
      filterClubsDirectory(clubs, "parking", zoneLabel).map((c) => c.name),
    ).toEqual(["Hoops Tennis"]);
    expect(
      filterClubsDirectory(clubs, "pay as you play", zoneLabel).map(
        (c) => c.name,
      ),
    ).toEqual(["Mountain Club"]);
  });

  it("does not pretend amenities are court surfaces", () => {
    expect(filterClubsDirectory(clubs, "clay", zoneLabel)).toEqual([]);
  });
});
