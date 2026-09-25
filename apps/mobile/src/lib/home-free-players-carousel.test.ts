import { describe, expect, it } from "vitest";
import {
  HOME_FREE_PLAYER_CARD_GAP,
  HOME_FREE_PLAYER_CARD_WIDTH,
  HOME_FREE_PLAYER_SNAP_INTERVAL,
  adjacentLiquidityOfferStartsAt,
  homeFreePlayerDetailLine,
  homeFreePlayerShouldAdvanceOffer,
  homeFreePlayerShouldRewindOffer,
  homeFreePlayerSnapOffsets,
} from "./home-free-players-carousel";

describe("homeFreePlayerSnapOffsets", () => {
  it("spaces each card by width plus gap and includes View all", () => {
    expect(HOME_FREE_PLAYER_SNAP_INTERVAL).toBe(
      HOME_FREE_PLAYER_CARD_WIDTH + HOME_FREE_PLAYER_CARD_GAP,
    );
    expect(homeFreePlayerSnapOffsets(3)).toEqual([0, 312, 624, 936]);
  });

  it("still includes a View all offset when there are no cards", () => {
    expect(homeFreePlayerSnapOffsets(0)).toEqual([0]);
  });
});

describe("adjacentLiquidityOfferStartsAt", () => {
  const offers = [{ startsAt: "a" }, { startsAt: "b" }, { startsAt: "c" }];

  it("steps to the next and previous offer", () => {
    expect(adjacentLiquidityOfferStartsAt(offers, "a", "next")).toBe("b");
    expect(adjacentLiquidityOfferStartsAt(offers, "b", "prev")).toBe("a");
  });

  it("returns null at the ends", () => {
    expect(adjacentLiquidityOfferStartsAt(offers, "c", "next")).toBeNull();
    expect(adjacentLiquidityOfferStartsAt(offers, "a", "prev")).toBeNull();
  });
});

describe("homeFreePlayerShouldAdvanceOffer", () => {
  it("advances on bounce past the end", () => {
    expect(
      homeFreePlayerShouldAdvanceOffer({
        offsetX: 540,
        contentWidth: 600,
        viewportWidth: 100,
        wasAtEnd: false,
      }),
    ).toBe(true);
  });

  it("advances once trailing slack is scrolled into view", () => {
    expect(
      homeFreePlayerShouldAdvanceOffer({
        offsetX: 540,
        contentWidth: 656,
        viewportWidth: 100,
        wasAtEnd: false,
        trailingSlackPx: 56,
      }),
    ).toBe(true);
  });

  it("does not advance while only parked on the last snap", () => {
    expect(
      homeFreePlayerShouldAdvanceOffer({
        offsetX: 500,
        contentWidth: 656,
        viewportWidth: 100,
        wasAtEnd: false,
        trailingSlackPx: 56,
      }),
    ).toBe(false);
  });

  it("advances on a forward fling while already at the end", () => {
    expect(
      homeFreePlayerShouldAdvanceOffer({
        offsetX: 500,
        contentWidth: 600,
        viewportWidth: 100,
        velocityX: 0.5,
        wasAtEnd: true,
      }),
    ).toBe(true);
  });

  it("does not advance from a mid-strip fling", () => {
    expect(
      homeFreePlayerShouldAdvanceOffer({
        offsetX: 200,
        contentWidth: 600,
        viewportWidth: 100,
        velocityX: 0.9,
        wasAtEnd: false,
      }),
    ).toBe(false);
  });
});

describe("homeFreePlayerShouldRewindOffer", () => {
  it("rewinds on bounce or fling at the start", () => {
    expect(
      homeFreePlayerShouldRewindOffer({
        offsetX: -50,
        wasAtStart: false,
      }),
    ).toBe(true);
    expect(
      homeFreePlayerShouldRewindOffer({
        offsetX: 0,
        velocityX: -0.5,
        wasAtStart: true,
      }),
    ).toBe(true);
  });
});

describe("homeFreePlayerDetailLine", () => {
  it("keeps compact clubs next to the area when there is a bio", () => {
    expect(
      homeFreePlayerDetailLine({
        about: "  Leftie,  likes  doubles  ",
        clubNames: ["Hoops", "Movenpick", "Riyadi"],
      }),
    ).toEqual({
      text: "Leftie, likes doubles",
      kind: "about",
      metaClubLabel: "Hoops +2",
    });
  });

  it("lists every preferred club in the slot when there is no bio", () => {
    expect(
      homeFreePlayerDetailLine({
        about: "   ",
        clubNames: ["Hoops", "Movenpick", "Pilot Tennis Club"],
      }),
    ).toEqual({
      text: "Hoops · Movenpick · Pilot Tennis Club",
      kind: "clubs",
      metaClubLabel: undefined,
    });
  });

  it("returns empty when there is neither bio nor clubs", () => {
    expect(homeFreePlayerDetailLine({ about: "", clubNames: [] })).toEqual({
      text: "",
      kind: "empty",
      metaClubLabel: undefined,
    });
  });
});
