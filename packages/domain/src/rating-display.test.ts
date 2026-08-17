import { describe, expect, it } from "vitest";
import {
  formatOwnRatingHeadline,
  formatOwnRatingStatValue,
  formatPublicPlayerLevelLabel,
  isProvisionalPlayerRating,
  PROVISIONAL_RATING_MATCH_THRESHOLD,
  ratedMatchesUntilRatingUnlock,
  ratingUnlockProgress,
} from "./rating-display";

describe("rating-display", () => {
  it("treats ratings below the threshold as provisional", () => {
    expect(isProvisionalPlayerRating(4)).toBe(true);
    expect(isProvisionalPlayerRating(5)).toBe(false);
    expect(PROVISIONAL_RATING_MATCH_THRESHOLD).toBe(5);
  });

  it("counts the rated matches still owed before the number is earned", () => {
    expect(ratedMatchesUntilRatingUnlock(0)).toBe(5);
    expect(ratedMatchesUntilRatingUnlock(4)).toBe(1);
    expect(ratedMatchesUntilRatingUnlock(5)).toBe(0);
    // Never counts backwards once the threshold is passed.
    expect(ratedMatchesUntilRatingUnlock(9)).toBe(0);
    expect(ratedMatchesUntilRatingUnlock(-1)).toBe(5);
  });

  it("reports unlock progress as a clamped share", () => {
    expect(ratingUnlockProgress(0)).toBe(0);
    expect(ratingUnlockProgress(2)).toBeCloseTo(0.4);
    expect(ratingUnlockProgress(5)).toBe(1);
    expect(ratingUnlockProgress(12)).toBe(1);
    expect(ratingUnlockProgress(-3)).toBe(0);
    expect(ratingUnlockProgress(0, 0)).toBe(1);
  });

  it("formats public player labels with provisional badge or earned rating", () => {
    expect(
      formatPublicPlayerLevelLabel({
        skillBand: "intermediate",
        displayRating: null,
        provisionalRatingLabel: "provisional",
        translateSkillBand: (band) => `Band:${band}`,
        translateProvisional: () => "Provisional",
      }),
    ).toBe("Band:intermediate · Provisional");

    expect(
      formatPublicPlayerLevelLabel({
        skillBand: "advanced",
        displayRating: 1288,
        provisionalRatingLabel: "established",
        translateSkillBand: (band) => `Band:${band}`,
        translateProvisional: () => "Provisional",
      }),
    ).toBe("Band:advanced · 1288");
  });

  it("formats own profile rating headlines", () => {
    expect(
      formatOwnRatingHeadline({
        ratedMatchCount: 2,
        internalRating: 1200,
        translateEarned: (value) => `Rating ${value}`,
        translateProvisional: (count, threshold) =>
          `Provisional ${count}/${threshold}`,
      }),
    ).toBe("Provisional 2/5");

    expect(
      formatOwnRatingHeadline({
        ratedMatchCount: 6,
        internalRating: 1312,
        translateEarned: (value) => `Rating ${value}`,
        translateProvisional: (count, threshold) =>
          `Provisional ${count}/${threshold}`,
      }),
    ).toBe("Rating 1312");
  });

  it("formats compact own rating stat values", () => {
    expect(
      formatOwnRatingStatValue({ ratedMatchCount: 0, internalRating: 1200 }),
    ).toEqual({ value: "0/5", isProvisional: true });

    expect(
      formatOwnRatingStatValue({ ratedMatchCount: 6, internalRating: 1312 }),
    ).toEqual({ value: "1312", isProvisional: false });
  });
});
