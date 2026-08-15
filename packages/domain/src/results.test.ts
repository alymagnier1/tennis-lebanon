import { describe, expect, it } from "vitest";
import {
  applyEloPair,
  canConfirmResult,
  canRecordAttendance,
  canResubmitResult,
  canSubmitResult,
  createDefaultSetDrafts,
  deriveWinningSide,
  formatMatchScore,
  isValidTennisSet,
  matchScoreSchema,
  parseMatchScoreDrafts,
  parseSetScoreDraft,
  sideForUser,
  tallySets,
  type MatchHubResult,
} from "./results";

function makeResult(overrides: Partial<MatchHubResult> = {}): MatchHubResult {
  return {
    result_id: "r1",
    status: "submitted",
    submitted_by: "a",
    score: { sets: [[6, 4]] },
    side_a_user_ids: ["a"],
    winning_side: 1,
    winner_user_id: "a",
    viewer_side: 2,
    viewer_won: false,
    revision: 1,
    ...overrides,
  };
}

describe("results", () => {
  it("validates score shape", () => {
    expect(
      matchScoreSchema.safeParse({
        sets: [
          [6, 4],
          [6, 3],
        ],
      }).success,
    ).toBe(true);
    expect(matchScoreSchema.safeParse({ sets: [] }).success).toBe(false);
    expect(
      matchScoreSchema.safeParse({ sets: new Array(6).fill([6, 4]) }).success,
    ).toBe(false);
  });

  it("accepts a legal set whichever side won it", () => {
    expect(isValidTennisSet(6, 4)).toBe(true);
    // The defect this format change exists to fix: side A losing a set used to
    // be unrepresentable, so a three-setter could not be recorded at all.
    expect(isValidTennisSet(4, 6)).toBe(true);
    expect(isValidTennisSet(7, 6)).toBe(true);
    expect(isValidTennisSet(6, 7)).toBe(true);
    expect(isValidTennisSet(6, 5)).toBe(false);
    expect(isValidTennisSet(6, 6)).toBe(false);
    expect(isValidTennisSet(5, 4)).toBe(false);
    expect(isValidTennisSet(6.5, 4)).toBe(false);
    expect(isValidTennisSet(-6, 4)).toBe(false);
  });

  it("derives the winner from the sets rather than being told", () => {
    expect(
      deriveWinningSide({
        sets: [
          [6, 4],
          [4, 6],
          [6, 3],
        ],
      }),
    ).toBe(1);
    expect(
      deriveWinningSide({
        sets: [
          [4, 6],
          [6, 4],
          [3, 6],
        ],
      }),
    ).toBe(2);
    // Level sets have no winner; this app does not record retirements.
    expect(
      deriveWinningSide({
        sets: [
          [6, 4],
          [4, 6],
        ],
      }),
    ).toBeNull();
    expect(
      tallySets({
        sets: [
          [6, 4],
          [4, 6],
          [6, 3],
        ],
      }),
    ).toEqual({ sideA: 2, sideB: 1 });
  });

  it("parses a three-setter the old format could not express", () => {
    const drafts = createDefaultSetDrafts(3);
    drafts[0] = { sideAGames: "6", sideBGames: "4" };
    drafts[1] = { sideAGames: "4", sideBGames: "6" };
    drafts[2] = { sideAGames: "6", sideBGames: "3" };

    expect(parseMatchScoreDrafts(drafts)).toEqual({
      ok: true,
      score: {
        sets: [
          [6, 4],
          [4, 6],
          [6, 3],
        ],
      },
      winningSide: 1,
    });
  });

  it("rejects incomplete, invalid, or winnerless drafts", () => {
    expect(parseSetScoreDraft({ sideAGames: "6", sideBGames: "" })).toEqual({
      ok: false,
      error: "empty",
    });
    expect(parseSetScoreDraft({ sideAGames: "6", sideBGames: "5" })).toEqual({
      ok: false,
      error: "invalidSet",
    });

    const level = createDefaultSetDrafts(2);
    level[0] = { sideAGames: "6", sideBGames: "4" };
    level[1] = { sideAGames: "4", sideBGames: "6" };
    expect(parseMatchScoreDrafts(level)).toEqual({
      ok: false,
      error: "noWinner",
    });
  });

  it("formats the score from the viewer's side", () => {
    const score = {
      sets: [
        [6, 4],
        [4, 6],
        [6, 3],
      ] as [number, number][],
    };
    expect(formatMatchScore(score, 1)).toBe("6-4, 4-6, 6-3");
    expect(formatMatchScore(score, 2)).toBe("4-6, 6-4, 3-6");
    expect(formatMatchScore(score)).toBe("6-4, 4-6, 6-3");
  });

  it("resolves which side a player was on", () => {
    const result = makeResult({ side_a_user_ids: ["a", "b"] });
    expect(sideForUser(result, "b")).toBe(1);
    expect(sideForUser(result, "z")).toBe(2);
  });

  it("allows attendance and score entry on a completed match", () => {
    // Attendance is what completes a match now, so by the time a score is
    // added the match has usually already completed.
    for (const matchStatus of ["in_progress", "completed"]) {
      expect(
        canRecordAttendance({
          matchStatus,
          viewerStatus: "accepted",
          viewerAttendance: "unknown",
        }),
      ).toBe(true);
      expect(
        canSubmitResult({
          matchStatus,
          viewerStatus: "accepted",
          hasResult: false,
        }),
      ).toBe(true);
    }

    expect(
      canSubmitResult({
        matchStatus: "confirmed",
        viewerStatus: "accepted",
        hasResult: false,
      }),
    ).toBe(false);
  });

  it("only lets the opposing side answer a submitted result", () => {
    const singles = makeResult();
    expect(
      canConfirmResult({
        matchStatus: "completed",
        viewerStatus: "accepted",
        viewerUserId: "b",
        result: singles,
      }),
    ).toBe(true);
    expect(
      canConfirmResult({
        matchStatus: "completed",
        viewerStatus: "accepted",
        viewerUserId: "a",
        result: singles,
      }),
    ).toBe(false);

    // Doubles: the submitter's own partner must not be able to rubber-stamp
    // their team's claim.
    const doubles = makeResult({ side_a_user_ids: ["a", "partner"] });
    expect(
      canConfirmResult({
        matchStatus: "completed",
        viewerStatus: "accepted",
        viewerUserId: "partner",
        result: doubles,
      }),
    ).toBe(false);
    expect(
      canConfirmResult({
        matchStatus: "completed",
        viewerStatus: "accepted",
        viewerUserId: "opponent",
        result: doubles,
      }),
    ).toBe(true);
  });

  it("gives the one reopen to whoever disputed", () => {
    const disputed = makeResult({
      status: "disputed",
      disputed_by: "b",
      revision: 1,
    });

    expect(
      canResubmitResult({
        viewerStatus: "accepted",
        viewerUserId: "b",
        result: disputed,
      }),
    ).toBe(true);
    expect(
      canResubmitResult({
        viewerStatus: "accepted",
        viewerUserId: "a",
        result: disputed,
      }),
    ).toBe(false);
    // A second disagreement is a real conflict and belongs to operations.
    expect(
      canResubmitResult({
        viewerStatus: "accepted",
        viewerUserId: "b",
        result: { ...disputed, revision: 2 },
      }),
    ).toBe(false);
  });

  it("offers no action on an unverified result", () => {
    const unverified = makeResult({ status: "unverified" });
    expect(
      canConfirmResult({
        matchStatus: "completed",
        viewerStatus: "accepted",
        viewerUserId: "b",
        result: unverified,
      }),
    ).toBe(false);
    expect(
      canResubmitResult({
        viewerStatus: "accepted",
        viewerUserId: "b",
        result: unverified,
      }),
    ).toBe(false);
  });

  it("increases winner rating and decreases loser rating", () => {
    const next = applyEloPair({ winnerRating: 1200, loserRating: 1200 });
    expect(next.winnerRating).toBeGreaterThan(1200);
    expect(next.loserRating).toBeLessThan(1200);
  });
});
