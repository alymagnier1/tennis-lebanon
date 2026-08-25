import { describe, expect, it } from "vitest";
import {
  HOME_FREE_PLAYER_CARD_GAP,
  HOME_FREE_PLAYER_CARD_WIDTH,
  HOME_FREE_PLAYER_SNAP_INTERVAL,
  homeFreePlayerDetailLine,
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
