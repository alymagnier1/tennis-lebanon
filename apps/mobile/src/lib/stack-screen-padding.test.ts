import { describe, expect, it } from "vitest";
import {
  STACK_SCREEN_TOP_GAP,
  pinnedBottomPadding,
  stackScreenTopPadding,
} from "./stack-screen-padding";

describe("stackScreenTopPadding", () => {
  it("adds the shared gap with no minimum floor", () => {
    expect(stackScreenTopPadding(0)).toBe(STACK_SCREEN_TOP_GAP);
    expect(stackScreenTopPadding(47)).toBe(47 + STACK_SCREEN_TOP_GAP);
  });
});

describe("pinnedBottomPadding", () => {
  it("leaves the gap above a 3-button navigation bar (the founder's phone)", () => {
    expect(pinnedBottomPadding(48, 12)).toBe(60);
  });

  it("keeps the old layout on a phone with no bar", () => {
    expect(pinnedBottomPadding(0, 12)).toBe(12);
  });

  it("clears a gesture handle or home indicator, then the gap", () => {
    expect(pinnedBottomPadding(34, 12)).toBe(46);
  });
});
