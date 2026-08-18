import { z } from "zod";

export const ATTENDANCE_SELF_REPORT_STATUSES = [
  "attended",
  "no_show",
  "late_cancel",
  "cancelled_in_time",
] as const;

export type AttendanceSelfReportStatus =
  (typeof ATTENDANCE_SELF_REPORT_STATUSES)[number];

/**
 * Sets are stored side-relative: `[sideAGames, sideBGames]`, where side A is
 * named on the result itself.
 *
 * They used to be winner-relative, which sounds equivalent and is not: it made
 * a set the declared winner had lost unrepresentable, so an ordinary
 * 6-4, 4-6, 6-3 could not be recorded at all. It also meant the winner had to
 * be supplied alongside the score rather than read out of it.
 */
export const matchScoreSchema = z.object({
  sets: z
    .array(z.tuple([z.number().int().min(0), z.number().int().min(0)]))
    .min(1)
    .max(5),
});

export type MatchScore = z.infer<typeof matchScoreSchema>;

export const MIN_MATCH_SETS = 1;
export const MAX_MATCH_SETS = 5;

/** 1 = side A, 2 = side B. */
export type MatchSide = 1 | 2;

export type SetScoreDraft = {
  sideAGames: string;
  sideBGames: string;
};

export type MatchScoreDraftError =
  | "empty"
  | "invalidNumber"
  | "invalidSet"
  | "setCount"
  | "invalidScore"
  | "noWinner";

export function createEmptySetDraft(): SetScoreDraft {
  return { sideAGames: "", sideBGames: "" };
}

export function createDefaultSetDrafts(count = 2): SetScoreDraft[] {
  return Array.from({ length: count }, () => createEmptySetDraft());
}

/**
 * Whether this is a legal tennis set, regardless of which side won it.
 *
 * Mirrors `public.is_valid_tennis_set`. The server is the authority; this
 * exists so the score editor can object before a round trip.
 */
export function isValidTennisSet(
  sideAGames: number,
  sideBGames: number,
): boolean {
  if (!Number.isInteger(sideAGames) || !Number.isInteger(sideBGames)) {
    return false;
  }
  if (sideAGames < 0 || sideBGames < 0) {
    return false;
  }

  const high = Math.max(sideAGames, sideBGames);
  const low = Math.min(sideAGames, sideBGames);

  if (high === 6 && low <= 4) {
    return true;
  }
  return high === 7 && (low === 5 || low === 6);
}

export function parseSetScoreDraft(draft: SetScoreDraft):
  | { ok: true; score: [number, number] }
  | {
      ok: false;
      error: Exclude<
        MatchScoreDraftError,
        "setCount" | "invalidScore" | "noWinner"
      >;
    } {
  if (!draft.sideAGames.trim() || !draft.sideBGames.trim()) {
    return { ok: false, error: "empty" };
  }

  const sideAGames = Number(draft.sideAGames);
  const sideBGames = Number(draft.sideBGames);
  if (!Number.isInteger(sideAGames) || !Number.isInteger(sideBGames)) {
    return { ok: false, error: "invalidNumber" };
  }
  if (!isValidTennisSet(sideAGames, sideBGames)) {
    return { ok: false, error: "invalidSet" };
  }

  return { ok: true, score: [sideAGames, sideBGames] };
}

/** Sets won by each side. Mirrors `public.validate_match_score`. */
export function tallySets(score: MatchScore): { sideA: number; sideB: number } {
  let sideA = 0;
  let sideB = 0;

  for (const [a, b] of score.sets) {
    if (a > b) {
      sideA += 1;
    } else {
      sideB += 1;
    }
  }

  return { sideA, sideB };
}

/**
 * Who won, read out of the score. Null when the sets are level, which this app
 * does not record — retirements and walkovers are an operations rule.
 *
 * Mirrors `public.derive_score_winner_side`.
 */
export function deriveWinningSide(score: MatchScore): MatchSide | null {
  const { sideA, sideB } = tallySets(score);
  if (sideA === sideB) {
    return null;
  }
  return sideA > sideB ? 1 : 2;
}

export function parseMatchScoreDrafts(
  drafts: SetScoreDraft[],
):
  | { ok: true; score: MatchScore; winningSide: MatchSide }
  | { ok: false; error: MatchScoreDraftError; setIndex?: number } {
  if (drafts.length < MIN_MATCH_SETS || drafts.length > MAX_MATCH_SETS) {
    return { ok: false, error: "setCount" };
  }

  const sets: [number, number][] = [];
  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    if (!draft) {
      return { ok: false, error: "invalidScore", setIndex: index };
    }
    const parsed = parseSetScoreDraft(draft);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error, setIndex: index };
    }
    sets.push(parsed.score);
  }

  const validated = matchScoreSchema.safeParse({ sets });
  if (!validated.success) {
    return { ok: false, error: "invalidScore" };
  }

  const winningSide = deriveWinningSide(validated.data);
  if (winningSide === null) {
    return { ok: false, error: "noWinner" };
  }

  return { ok: true, score: validated.data, winningSide };
}

/**
 * Renders "6-4, 4-6, 6-3" from `viewerSide`'s point of view, so a player always
 * reads their own games first. Defaults to side A when the viewer is unknown.
 */
export function formatMatchScore(
  score: MatchScore,
  viewerSide: MatchSide = 1,
): string {
  return score.sets
    .map(([sideAGames, sideBGames]) =>
      viewerSide === 1
        ? `${sideAGames}-${sideBGames}`
        : `${sideBGames}-${sideAGames}`,
    )
    .join(", ");
}

export const RESULT_STATUSES = [
  "submitted",
  "confirmed",
  "disputed",
  "resolved",
  "unverified",
] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

export type MatchHubResult = {
  result_id: string;
  status: ResultStatus;
  submitted_by: string;
  submitted_by_name?: string | null;
  score: MatchScore;
  side_a_user_ids: string[];
  winning_side: MatchSide;
  winner_user_id: string;
  viewer_side: MatchSide;
  viewer_won: boolean;
  revision: number;
  confirmed_by?: string | null;
  disputed_by?: string | null;
  dispute_note?: string | null;
};

/** 1 if the player is on side A of this result, 2 otherwise. */
export function sideForUser(
  result: Pick<MatchHubResult, "side_a_user_ids">,
  userId: string,
): MatchSide {
  return result.side_a_user_ids.includes(userId) ? 1 : 2;
}

/**
 * Attendance and score entry are both live on `completed` now, not only
 * `in_progress`: attendance is what completes the match, so by the time a score
 * is added the match has usually already completed.
 */
const OUTCOME_STATUSES = new Set(["in_progress", "completed"]);

export function canRecordAttendance(input: {
  matchStatus: string;
  viewerStatus: string | null;
  viewerAttendance: string;
}): boolean {
  return (
    OUTCOME_STATUSES.has(input.matchStatus) &&
    input.viewerStatus === "accepted" &&
    input.viewerAttendance === "unknown"
  );
}

/** Viewer said they were not there — no score, and no pending-result nag. */
export function viewerDeclinedToPlay(
  attendance: string | null | undefined,
): boolean {
  return (
    attendance === "no_show" ||
    attendance === "late_cancel" ||
    attendance === "cancelled_in_time"
  );
}

export function canSubmitResult(input: {
  matchStatus: string;
  viewerStatus: string | null;
  hasResult: boolean;
  /** Score is only for players who said they played. */
  viewerAttendance: string;
}): boolean {
  return (
    OUTCOME_STATUSES.has(input.matchStatus) &&
    input.viewerStatus === "accepted" &&
    input.viewerAttendance === "attended" &&
    !input.hasResult
  );
}

export function canConfirmResult(input: {
  matchStatus: string;
  viewerStatus: string | null;
  viewerUserId: string;
  result: MatchHubResult | null;
}): boolean {
  const { result } = input;
  if (
    !result ||
    !OUTCOME_STATUSES.has(input.matchStatus) ||
    input.viewerStatus !== "accepted" ||
    result.status !== "submitted" ||
    result.submitted_by === input.viewerUserId
  ) {
    return false;
  }

  // In doubles this is the rule that stops the submitter's own partner
  // rubber-stamping their team's claim. In singles it is already implied by the
  // submitter check above.
  return (
    sideForUser(result, input.viewerUserId) !==
    sideForUser(result, result.submitted_by)
  );
}

/**
 * Identical preconditions to confirming — both are the opposing side answering
 * a submitted result. Kept as its own name because the call sites read better,
 * and because only one of the two leads anywhere else.
 */
export const canDisputeResult = canConfirmResult;

/**
 * Disagreeing hands the pen back, once. Only the player who objected may
 * replace the score, and only before it has already been reopened.
 */
export function canResubmitResult(input: {
  viewerStatus: string | null;
  viewerUserId: string;
  result: MatchHubResult | null;
}): boolean {
  const { result } = input;
  return Boolean(
    result &&
    input.viewerStatus === "accepted" &&
    result.status === "disputed" &&
    result.revision === 1 &&
    result.disputed_by === input.viewerUserId,
  );
}

export function computeEloDelta(input: {
  playerRating: number;
  opponentRating: number;
  score: 0 | 1;
  kFactor?: number;
}): number {
  const k = input.kFactor ?? 32;
  const expected =
    1 / (1 + 10 ** ((input.opponentRating - input.playerRating) / 400));
  return Math.round(k * (input.score - expected));
}

export function applyEloPair(input: {
  winnerRating: number;
  loserRating: number;
  kFactor?: number;
}): { winnerRating: number; loserRating: number } {
  const winnerDelta = computeEloDelta({
    playerRating: input.winnerRating,
    opponentRating: input.loserRating,
    score: 1,
    kFactor: input.kFactor,
  });
  const loserDelta = computeEloDelta({
    playerRating: input.loserRating,
    opponentRating: input.winnerRating,
    score: 0,
    kFactor: input.kFactor,
  });

  return {
    winnerRating: clampRating(input.winnerRating + winnerDelta),
    loserRating: clampRating(input.loserRating + loserDelta),
  };
}

function clampRating(value: number): number {
  return Math.max(100, Math.min(3000, value));
}
