import { describe, expect, it } from "vitest";
import {
  horizontalScreenPadding,
  isNarrowScreen,
  NARROW_SCREEN_WIDTH,
  screenTitleFontSize,
} from "./screen-metrics";

describe("screen metrics", () => {
  it("treats widths below the breakpoint as narrow", () => {
    expect(isNarrowScreen(NARROW_SCREEN_WIDTH - 1)).toBe(true);
    expect(isNarrowScreen(NARROW_SCREEN_WIDTH)).toBe(false);
  });

  it("uses tighter horizontal padding on narrow screens", () => {
    expect(horizontalScreenPadding(320)).toBeLessThan(
      horizontalScreenPadding(390),
    );
  });

  it("uses a smaller title size on narrow screens", () => {
    expect(screenTitleFontSize(320)).toBeLessThan(screenTitleFontSize(390));
  });
});
