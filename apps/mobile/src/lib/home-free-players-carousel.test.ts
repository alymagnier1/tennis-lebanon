import { describe, expect, it } from "vitest";
import {
  HOME_FREE_PLAYER_CARD_GAP,
  HOME_FREE_PLAYER_CARD_WIDTH,
  HOME_FREE_PLAYER_SNAP_INTERVAL,
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
