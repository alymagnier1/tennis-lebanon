import { describe, expect, it } from "vitest";
import {
  STACK_SCREEN_TOP_GAP,
  stackScreenTopPadding,
} from "./stack-screen-padding";

describe("stackScreenTopPadding", () => {
  it("adds the shared gap with no minimum floor", () => {
    expect(stackScreenTopPadding(0)).toBe(STACK_SCREEN_TOP_GAP);
    expect(stackScreenTopPadding(47)).toBe(47 + STACK_SCREEN_TOP_GAP);
  });
});
