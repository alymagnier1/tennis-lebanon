import { describe, expect, it } from "vitest";
import {
  matchCardAreaLabel,
  matchCardClubLabel,
  preferredClubLocationLabel,
} from "./match-clubs";

describe("preferredClubLocationLabel", () => {
  it("prefers the public address", () => {
    expect(
      preferredClubLocationLabel({
        addressPublic: "  Rue 1, Achrafieh ",
        zoneNameI18n: { en: "Beirut" },
        locale: "en",
      }),
    ).toBe("Rue 1, Achrafieh");
  });

  it("falls back to the zone name", () => {
    expect(
      preferredClubLocationLabel({
        addressPublic: null,
        zoneNameI18n: { en: "Metn", ar: "المتن" },
        locale: "ar",
      }),
    ).toBe("المتن");
  });

  it("is null when nothing public is stored", () => {
    expect(
      preferredClubLocationLabel({
        addressPublic: "  ",
        zoneNameI18n: null,
        locale: "en",
      }),
    ).toBeNull();
  });
});

describe("matchCardClubLabel", () => {
  it("prefers the booked club over preferred clubs", () => {
    expect(
      matchCardClubLabel({
        clubName: "Hoops",
        preferredClubs: [{ club_id: "1", name: "Movempic" }],
      }),
    ).toBe("Hoops");
  });

  it("uses preferred clubs when nothing is booked", () => {
    expect(
      matchCardClubLabel({
        clubName: null,
        preferredClubs: [
          { club_id: "1", name: "Hoops" },
          { club_id: "2", name: "Movempic" },
        ],
      }),
    ).toBe("Hoops · Movempic");
  });

  it("falls back to court-secured copy when only hasCourt is set", () => {
    expect(
      matchCardClubLabel({
        clubName: null,
        preferredClubs: [],
        hasCourt: true,
        courtSecuredFallback: "Court secured",
      }),
    ).toBe("Court secured");
  });
});

describe("matchCardAreaLabel", () => {
  it("joins zone names for the locale", () => {
    expect(
      matchCardAreaLabel(
        [
          { id: "1", slug: "beirut", name_i18n: { en: "Beirut" } },
          { id: "2", slug: "metn", name_i18n: { en: "Metn" } },
        ],
        "en",
      ),
    ).toBe("Beirut · Metn");
  });

  it("is undefined when empty", () => {
    expect(matchCardAreaLabel([], "en")).toBeUndefined();
    expect(matchCardAreaLabel(null, "en")).toBeUndefined();
  });
});
