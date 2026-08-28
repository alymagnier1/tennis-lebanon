import { describe, expect, it } from "vitest";
import {
  HOME_NEXT_ACTION_GAP,
  HOME_NEXT_ACTION_PEEK,
  homeNextActionCardWidth,
  homeNextActionPageIndex,
  homeNextActionSnapInterval,
  homeNextActionSnapOffsets,
} from "./home-next-action-carousel";

describe("home next-action carousel layout", () => {
  it("leaves a peek so the next card is visible", () => {
    expect(homeNextActionCardWidth(334)).toBe(334 - HOME_NEXT_ACTION_PEEK);
    expect(homeNextActionSnapInterval(314)).toBe(314 + HOME_NEXT_ACTION_GAP);
  });

  it("snaps each page to card width plus gap", () => {
    expect(homeNextActionSnapOffsets(3, 300)).toEqual([0, 312, 624]);
  });

  it("maps a scroll offset to a page without overflowing", () => {
    expect(homeNextActionPageIndex(0, 300, 3)).toBe(0);
    expect(homeNextActionPageIndex(312, 300, 3)).toBe(1);
    expect(homeNextActionPageIndex(900, 300, 3)).toBe(2);
    expect(homeNextActionPageIndex(-312, 300, 3)).toBe(1);
  });
});
