import { describe, expect, it } from "vitest";
import {
  ANDROID_NAV_FALLBACK_BOTTOM,
  STACK_SCREEN_TOP_GAP,
  stackScreenBottomPadding,
  stackScreenTopPadding,
} from "./stack-screen-padding";

describe("stackScreenTopPadding", () => {
  it("adds the shared gap with no minimum floor", () => {
    expect(stackScreenTopPadding(0)).toBe(STACK_SCREEN_TOP_GAP);
    expect(stackScreenTopPadding(47)).toBe(47 + STACK_SCREEN_TOP_GAP);
  });
});

describe("stackScreenBottomPadding", () => {
  it("trusts a real inset (gesture nav, iOS home indicator)", () => {
    expect(stackScreenBottomPadding(34)).toBe(34);
    expect(stackScreenBottomPadding(21)).toBe(21);
  });

  it("floors to the nav-bar height when the inset reads as missing (the confirmed bug)", () => {
    expect(stackScreenBottomPadding(0)).toBe(ANDROID_NAV_FALLBACK_BOTTOM);
  });

  it("never returns less than the real inset once it is non-zero", () => {
    expect(stackScreenBottomPadding(1)).toBe(1);
  });
});
