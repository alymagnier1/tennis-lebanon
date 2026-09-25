import { describe, expect, it } from "vitest";
import {
  cheapestClubPrice,
  clubBrowsePrimaryAction,
  clubFactChips,
  clubHasIndoorCourt,
  clubMatchPrimaryAction,
  clubAmenityI18nKey,
  humanizeClubAmenity,
  uniqueClubSurfaces,
} from "./club-detail-layout";

const hardOutdoor = {
  surface: "hard",
  is_indoor: false,
  price_minor: 4000_00,
  currency: "LBP",
};

const clayIndoor = {
  surface: "clay",
  is_indoor: true,
  price_minor: 2500_00,
  currency: "LBP",
};

describe("clubBrowsePrimaryAction", () => {
  it("offers WhatsApp when the club can open a thread", () => {
    expect(clubBrowsePrimaryAction(true)).toBe("whatsapp");
  });

  it("offers nothing when browsing a club without WhatsApp", () => {
    expect(clubBrowsePrimaryAction(false)).toBe("none");
  });
});

describe("clubMatchPrimaryAction", () => {
  it("prefers WhatsApp over an in-app request so there is one primary", () => {
    expect(
      clubMatchPrimaryAction({
        whatsapp_booking_available: true,
        booking_mode: "manual_request",
      }),
    ).toBe("whatsapp");
  });

  it("falls back to a request when WhatsApp is not available", () => {
    expect(
      clubMatchPrimaryAction({
        whatsapp_booking_available: false,
        booking_mode: "manual_request",
      }),
    ).toBe("request");
  });

  it("is none when the club has no booking path", () => {
    expect(
      clubMatchPrimaryAction({
        whatsapp_booking_available: false,
        booking_mode: "unknown",
      }),
    ).toBe("none");
  });
});

describe("clubFactChips", () => {
  it("lists court count, unique surfaces, indoor, and the cheapest price", () => {
    expect(clubFactChips([hardOutdoor, clayIndoor, hardOutdoor])).toEqual([
      { kind: "courts", count: 3 },
      { kind: "surface", surface: "hard" },
      { kind: "surface", surface: "clay" },
      { kind: "indoor" },
      { kind: "fromPrice", priceLabel: "LBP 2500" },
    ]);
  });

  it("omits indoor and price when nothing supports them", () => {
    expect(
      clubFactChips([
        {
          surface: "hard",
          is_indoor: false,
          price_minor: null,
          currency: null,
        },
      ]),
    ).toEqual([
      { kind: "courts", count: 1 },
      { kind: "surface", surface: "hard" },
    ]);
  });

  it("is empty when the club has no courts yet", () => {
    expect(clubFactChips([])).toEqual([]);
  });
});

describe("uniqueClubSurfaces", () => {
  it("keeps first-seen order", () => {
    expect(uniqueClubSurfaces([clayIndoor, hardOutdoor, clayIndoor])).toEqual([
      "clay",
      "hard",
    ]);
  });
});

describe("cheapestClubPrice", () => {
  it("ignores courts without a price", () => {
    expect(
      cheapestClubPrice([{ ...hardOutdoor, price_minor: null }, clayIndoor]),
    ).toEqual({ price_minor: 2500_00, currency: "LBP" });
  });
});

describe("clubHasIndoorCourt", () => {
  it("is true when any court is indoor", () => {
    expect(clubHasIndoorCourt([hardOutdoor, clayIndoor])).toBe(true);
    expect(clubHasIndoorCourt([hardOutdoor])).toBe(false);
  });
});

describe("club amenity labels", () => {
  it("maps seeded amenities to i18n keys", () => {
    expect(clubAmenityI18nKey("parking")).toBe("clubs.amenity.parking");
    expect(clubAmenityI18nKey("showers")).toBe("clubs.amenity.showers");
    expect(clubAmenityI18nKey("pay_as_you_play")).toBe(
      "clubs.amenity.pay_as_you_play",
    );
  });

  it("humanizes unknown operator tags instead of inventing copy", () => {
    expect(clubAmenityI18nKey("cafe")).toBeNull();
    expect(humanizeClubAmenity("pay_as_you_play")).toBe("pay as you play");
  });
});
