import { describe, expect, it } from "vitest";
import {
  HOME_NEXT_ACTION_END_PADDING,
  HOME_NEXT_ACTION_GAP,
  HOME_NEXT_ACTION_PEEK,
  homeNextActionCardWidth,
  homeNextActionDotProgressRange,
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

  it("keeps the last snap offset inside the scrollable range", () => {
    const viewport = 334;
    const cardWidth = homeNextActionCardWidth(viewport);
    const count = 3;
    const contentWidth =
      count * cardWidth +
      (count - 1) * HOME_NEXT_ACTION_GAP +
      HOME_NEXT_ACTION_END_PADDING;
    const maxOffset = contentWidth - viewport;
    const offsets = homeNextActionSnapOffsets(count, cardWidth);
    expect(offsets[offsets.length - 1]).toBeLessThanOrEqual(maxOffset);
  });

  it("peaks each dot on its own page and mirrors for RTL web offsets", () => {
    const first = homeNextActionDotProgressRange(0, 300);
    expect(first.inputRange).toEqual([-312, 0, 312]);
    expect(first.outputRange).toEqual([0, 1, 0]);

    const second = homeNextActionDotProgressRange(1, 300);
    expect(second.inputRange).toEqual([-624, -312, 0, 0, 312, 624]);
    expect(second.outputRange).toEqual([0, 1, 0, 0, 1, 0]);
    for (let i = 1; i < second.inputRange.length; i += 1) {
      expect(second.inputRange[i]!).toBeGreaterThanOrEqual(
        second.inputRange[i - 1]!,
      );
    }
  });

  it("maps a scroll offset to a page without overflowing", () => {
    expect(homeNextActionPageIndex(0, 300, 3)).toBe(0);
    expect(homeNextActionPageIndex(312, 300, 3)).toBe(1);
    expect(homeNextActionPageIndex(900, 300, 3)).toBe(2);
    expect(homeNextActionPageIndex(-312, 300, 3)).toBe(1);
  });
});
