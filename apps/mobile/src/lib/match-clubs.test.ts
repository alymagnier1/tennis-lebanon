import { describe, expect, it } from "vitest";
import { preferredClubLocationLabel } from "./match-clubs";

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
