import { describe, expect, it } from "vitest";
import {
  applyEloPair,
  canConfirmResult,
  canRecordAttendance,
  canSubmitResult,
  matchScoreSchema,
} from "./results";

describe("results", () => {
  it("validates score shape", () => {
    expect(
      matchScoreSchema.safeParse({ sets: [[6, 4], [6, 3]] }).success,
    ).toBe(true);
    expect(matchScoreSchema.safeParse({ sets: [] }).success).toBe(false);
  });

  it("gates attendance and submission actions", () => {
    expect(
      canRecordAttendance({
        matchStatus: "in_progress",
        viewerStatus: "accepted",
        viewerAttendance: "unknown",
      }),
    ).toBe(true);
    expect(
      canSubmitResult({
        matchStatus: "in_progress",
        viewerStatus: "accepted",
        hasResult: false,
      }),
    ).toBe(true);
    expect(
      canConfirmResult({
        matchStatus: "in_progress",
        viewerStatus: "accepted",
        viewerUserId: "b",
        result: {
          result_id: "1",
          status: "submitted",
          submitted_by: "a",
          score: { sets: [[6, 4]] },
          winner_user_id: "a",
        },
      }),
    ).toBe(true);
  });

  it("increases winner rating and decreases loser rating", () => {
    const next = applyEloPair({ winnerRating: 1200, loserRating: 1200 });
    expect(next.winnerRating).toBeGreaterThan(1200);
    expect(next.loserRating).toBeLessThan(1200);
  });
});
