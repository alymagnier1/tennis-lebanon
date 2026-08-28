import { describe, expect, it } from "vitest";
import {
  isLastOpenMatchSpot,
  openMatchScarcityBadges,
  openMatchSpotsLeft,
} from "./open-match-scarcity";

describe("openMatchSpotsLeft", () => {
  it("returns remaining seats", () => {
    expect(openMatchSpotsLeft(1, 2)).toBe(1);
    expect(openMatchSpotsLeft(1, 4)).toBe(3);
    expect(openMatchSpotsLeft(2, 2)).toBe(0);
  });

  it("treats invalid capacity as no signal", () => {
    expect(openMatchSpotsLeft(1, 0)).toBe(0);
    expect(openMatchSpotsLeft(Number.NaN, 2)).toBe(0);
  });
});

describe("isLastOpenMatchSpot", () => {
  it("is true only for a single remaining seat", () => {
    expect(isLastOpenMatchSpot(1, 2)).toBe(true);
    expect(isLastOpenMatchSpot(1, 4)).toBe(false);
    expect(isLastOpenMatchSpot(3, 4)).toBe(true);
  });
});

describe("openMatchScarcityBadges", () => {
  const labels = {
    oneSpotLeft: "1 spot left",
    courtSecured: "Court secured",
  };

  it("omits the spots chip when more than one seat remains", () => {
    expect(
      openMatchScarcityBadges(
        { participant_count: 1, capacity: 4, court_secured: false },
        labels,
      ),
    ).toBeUndefined();
  });

  it("shows last seat and court when both are true", () => {
    expect(
      openMatchScarcityBadges(
        { participant_count: 1, capacity: 2, court_secured: true },
        labels,
      ),
    ).toEqual([
      { label: "1 spot left", tone: "attention" },
      { label: "Court secured", tone: "positive" },
    ]);
  });
});
