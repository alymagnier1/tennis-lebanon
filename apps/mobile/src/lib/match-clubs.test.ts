import { describe, expect, it } from "vitest";
import {
  compactJoinedLabel,
  joinedListTypeSize,
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

describe("compactJoinedLabel", () => {
  it("returns undefined for empty input", () => {
    expect(compactJoinedLabel([])).toBeUndefined();
  });

  it("keeps a short list intact", () => {
    expect(compactJoinedLabel(["Hoops"])).toBe("Hoops");
  });

  it("adds a +N overflow count", () => {
    expect(compactJoinedLabel(["Hoops", "Movempic", "Riyadi"])).toBe(
      "Hoops +2",
    );
  });

  it("can keep two names before the overflow count", () => {
    expect(compactJoinedLabel(["Hoops", "Movempic", "Riyadi"], 2)).toBe(
      "Hoops · Movempic +1",
    );
  });
});

describe("joinedListTypeSize", () => {
  it("shrinks type as more names share the line", () => {
    expect(joinedListTypeSize(1).fontSize).toBe(14);
    expect(joinedListTypeSize(2).fontSize).toBe(12);
    expect(joinedListTypeSize(3).fontSize).toBe(10);
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

  it("compacts multi-club lists for dense cards", () => {
    expect(
      matchCardClubLabel({
        clubName: null,
        preferredClubs: [
          { club_id: "1", name: "Hoops" },
          { club_id: "2", name: "Movempic" },
        ],
        compact: true,
      }),
    ).toBe("Hoops +1");
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

  it("compacts multi-zone lists for dense cards", () => {
    expect(
      matchCardAreaLabel(
        [
          { id: "1", slug: "north", name_i18n: { en: "Pilot North" } },
          { id: "2", slug: "central", name_i18n: { en: "Pilot Central" } },
          { id: "3", slug: "south", name_i18n: { en: "Pilot South" } },
        ],
        "en",
        { compact: true },
      ),
    ).toBe("Pilot North +2");
  });

  it("is undefined when empty", () => {
    expect(matchCardAreaLabel([], "en")).toBeUndefined();
    expect(matchCardAreaLabel(null, "en")).toBeUndefined();
  });
});
