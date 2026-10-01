import { describe, expect, it } from "vitest";
import {
  SNAP_FLING_VX,
  SNAP_SETTLE_IDLE_MS,
  SNAP_SETTLE_MAX_MS,
  SNAP_SETTLE_MIN_MS,
  snapStripDragPosition,
  snapStripRubberBand,
  snapStripSettleMs,
  snapStripTargetIndex,
} from "./snap-strip";

const offsets = [0, 312, 624, 800];

describe("snapStripTargetIndex", () => {
  it("pages forward on a fast swipe, even a short one", () => {
    expect(snapStripTargetIndex({ offsets, position: 40, velocity: 2.5 })).toBe(
      1,
    );
  });

  it("never skips a page on a hard fling", () => {
    expect(snapStripTargetIndex({ offsets, position: 330, velocity: 8 })).toBe(
      2,
    );
  });

  it("pages back on a fast swipe the other way", () => {
    expect(snapStripTargetIndex({ offsets, position: 600, velocity: -1 })).toBe(
      1,
    );
  });

  it("settles on the nearest page when released slowly", () => {
    expect(
      snapStripTargetIndex({
        offsets,
        position: 200,
        velocity: SNAP_FLING_VX / 2,
      }),
    ).toBe(1);
    expect(snapStripTargetIndex({ offsets, position: 120, velocity: 0 })).toBe(
      0,
    );
  });

  it("stays within the ends", () => {
    expect(snapStripTargetIndex({ offsets, position: 820, velocity: 3 })).toBe(
      3,
    );
    expect(snapStripTargetIndex({ offsets, position: -30, velocity: -3 })).toBe(
      0,
    );
    expect(
      snapStripTargetIndex({ offsets: [], position: 0, velocity: 1 }),
    ).toBe(0);
  });
});

describe("snapStripSettleMs", () => {
  it("leaves the finger at its release speed (ease-out cubic starts at 3x average)", () => {
    expect(snapStripSettleMs(300, 3)).toBe(300);
  });

  it("stays within bounds for very fast and very slow releases", () => {
    expect(snapStripSettleMs(300, 20)).toBe(SNAP_SETTLE_MIN_MS);
    expect(snapStripSettleMs(300, 0.2)).toBe(SNAP_SETTLE_MAX_MS);
  });

  it("uses a fixed ease for a release with no speed", () => {
    expect(snapStripSettleMs(150, 0)).toBe(SNAP_SETTLE_IDLE_MS);
  });
});

describe("snapStripDragPosition", () => {
  it("follows the finger between the ends", () => {
    expect(
      snapStripDragPosition({ raw: 400, first: 0, last: 800, span: 360 }),
    ).toBe(400);
  });

  it("resists past either end, less and less", () => {
    const small = snapStripDragPosition({
      raw: -50,
      first: 0,
      last: 800,
      span: 360,
    });
    const large = snapStripDragPosition({
      raw: -200,
      first: 0,
      last: 800,
      span: 360,
    });
    expect(small).toBeLessThan(0);
    expect(small).toBeGreaterThan(-50);
    expect(large).toBeLessThan(small);
    expect(large - small).toBeGreaterThan(-150);
    expect(
      snapStripDragPosition({ raw: 850, first: 0, last: 800, span: 360 }),
    ).toBeLessThan(850);
  });

  it("never pulls further than the span", () => {
    expect(Math.abs(snapStripRubberBand(-100000, 360))).toBeLessThan(360);
    expect(snapStripRubberBand(50, 0)).toBe(0);
  });
});
