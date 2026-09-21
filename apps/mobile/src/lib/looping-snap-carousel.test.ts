import { describe, expect, it } from "vitest";
import {
  loopingCarouselItems,
  loopingCarouselJumpCloneIndex,
  loopingCarouselOffsetIsSettled,
  loopingCarouselRealIndex,
  loopingCarouselStartCloneIndex,
} from "./looping-snap-carousel";

describe("loopingCarouselItems", () => {
  it("leaves a single item uncloned", () => {
    expect(loopingCarouselItems(["a"])).toEqual(["a"]);
  });

  it("wraps the last item in front and the first behind", () => {
    expect(loopingCarouselItems(["a", "b"])).toEqual(["b", "a", "b", "a"]);
    expect(loopingCarouselItems(["a", "b", "c"])).toEqual([
      "c",
      "a",
      "b",
      "c",
      "a",
    ]);
  });
});

describe("loopingCarouselRealIndex", () => {
  it("maps cloned slides back onto the real items", () => {
    expect(loopingCarouselStartCloneIndex(2)).toBe(1);
    expect(loopingCarouselRealIndex(0, 2)).toBe(1);
    expect(loopingCarouselRealIndex(1, 2)).toBe(0);
    expect(loopingCarouselRealIndex(2, 2)).toBe(1);
    expect(loopingCarouselRealIndex(3, 2)).toBe(0);
  });
});

describe("loopingCarouselJumpCloneIndex", () => {
  it("jumps off the leading clone onto the real last item", () => {
    expect(loopingCarouselJumpCloneIndex(0, 2)).toBe(2);
    expect(loopingCarouselJumpCloneIndex(0, 3)).toBe(3);
  });

  it("jumps off the trailing clone onto the real first item", () => {
    expect(loopingCarouselJumpCloneIndex(3, 2)).toBe(1);
    expect(loopingCarouselJumpCloneIndex(4, 3)).toBe(1);
  });

  it("leaves real slides in place", () => {
    expect(loopingCarouselJumpCloneIndex(1, 2)).toBeNull();
    expect(loopingCarouselJumpCloneIndex(2, 2)).toBeNull();
  });
});

describe("loopingCarouselOffsetIsSettled", () => {
  it("is true on a snap page and false mid-swipe", () => {
    expect(loopingCarouselOffsetIsSettled(624, 312)).toBe(true);
    expect(loopingCarouselOffsetIsSettled(400, 312)).toBe(false);
  });
});
