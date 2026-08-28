import { describe, expect, it } from "vitest";
import {
  compactJoinedLabel,
  joinedListTypeSize,
  matchCardAreaLabel,
  matchCardClubLabel,
  preferredClubLocationLabel,
  zonesWithoutPreferredClub,
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

describe("zonesWithoutPreferredClub", () => {
  const zoneOptions = [
    { value: "z-hamra", label: "Hamra" },
    { value: "z-achrafieh", label: "Achrafieh" },
    { value: "z-jounieh", label: "Jounieh" },
  ];

  const clubs = [
    { club_id: "c-1", zone_id: "z-hamra" },
    { club_id: "c-2", zone_id: "z-hamra" },
    { club_id: "c-3", zone_id: "z-achrafieh" },
  ];

  it("names the advertised zones no chosen club sits in", () => {
    expect(
      zonesWithoutPreferredClub({
        zoneOptions,
        selectedZoneIds: ["z-hamra", "z-achrafieh", "z-jounieh"],
        clubs,
        selectedClubIds: ["c-1"],
      }),
    ).toEqual(["Achrafieh", "Jounieh"]);
  });

  it("stays quiet when every zone has a chosen club", () => {
    expect(
      zonesWithoutPreferredClub({
        zoneOptions,
        selectedZoneIds: ["z-hamra", "z-achrafieh"],
        clubs,
        selectedClubIds: ["c-2", "c-3"],
      }),
    ).toEqual([]);
  });

  // Clubs are required for public matches only, so an invite-only host with no
  // club has made no mistake — warning on every zone would be noise.
  it("stays quiet when no club is chosen at all", () => {
    expect(
      zonesWithoutPreferredClub({
        zoneOptions,
        selectedZoneIds: ["z-hamra", "z-jounieh"],
        clubs,
        selectedClubIds: [],
      }),
    ).toEqual([]);
  });

  it("skips a zone it cannot label rather than emitting a blank", () => {
    expect(
      zonesWithoutPreferredClub({
        zoneOptions,
        selectedZoneIds: ["z-hamra", "z-unknown"],
        clubs,
        selectedClubIds: ["c-3"],
      }),
    ).toEqual(["Hamra"]);
  });
});
