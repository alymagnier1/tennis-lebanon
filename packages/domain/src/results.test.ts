import { describe, expect, it } from "vitest";
import {
  applyEloPair,
  canConfirmResult,
  canRecordAttendance,
  canSubmitResult,
  createDefaultSetDrafts,
  formatMatchScore,
  isValidTennisSet,
  matchScoreSchema,
  parseMatchScoreDrafts,
  parseSetScoreDraft,
} from "./results";

describe("results", () => {
  it("validates score shape", () => {
    expect(
      matchScoreSchema.safeParse({ sets: [[6, 4], [6, 3]] }).success,
    ).toBe(true);
    expect(matchScoreSchema.safeParse({ sets: [] }).success).toBe(false);
  });

  it("validates tennis set scores", () => {
    expect(isValidTennisSet(6, 4)).toBe(true);
    expect(isValidTennisSet(7, 6)).toBe(true);
    expect(isValidTennisSet(6, 5)).toBe(false);
    expect(isValidTennisSet(5, 4)).toBe(false);
  });

  it("parses score drafts from winner perspective", () => {
    const drafts = createDefaultSetDrafts(2);
    drafts[0] = { winnerGames: "6", loserGames: "4" };
    drafts[1] = { winnerGames: "6", loserGames: "3" };

    expect(parseMatchScoreDrafts(drafts)).toEqual({
      ok: true,
      score: { sets: [[6, 4], [6, 3]] },
    });
    expect(formatMatchScore({ sets: [[6, 4], [6, 3]] })).toBe("6-4, 6-3");
  });

  it("rejects incomplete or invalid set drafts", () => {
    expect(parseSetScoreDraft({ winnerGames: "6", loserGames: "" })).toEqual({
      ok: false,
      error: "empty",
    });
    expect(parseSetScoreDraft({ winnerGames: "6", loserGames: "5" })).toEqual({
      ok: false,
      error: "invalidSet",
    });
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
