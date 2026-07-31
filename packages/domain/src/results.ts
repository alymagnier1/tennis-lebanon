import { z } from "zod";

export const ATTENDANCE_SELF_REPORT_STATUSES = [
  "attended",
  "no_show",
  "late_cancel",
  "cancelled_in_time",
] as const;

export type AttendanceSelfReportStatus =
  (typeof ATTENDANCE_SELF_REPORT_STATUSES)[number];

export const matchScoreSchema = z.object({
  sets: z
    .array(z.tuple([z.number().int().min(0), z.number().int().min(0)]))
    .min(1),
});

export type MatchScore = z.infer<typeof matchScoreSchema>;

export const MIN_MATCH_SETS = 1;
export const MAX_MATCH_SETS = 5;

export type SetScoreDraft = {
  winnerGames: string;
  loserGames: string;
};

export type MatchScoreDraftError =
  "empty" | "invalidNumber" | "invalidSet" | "setCount" | "invalidScore";

export function createEmptySetDraft(): SetScoreDraft {
  return { winnerGames: "", loserGames: "" };
}

export function createDefaultSetDrafts(count = 2): SetScoreDraft[] {
  return Array.from({ length: count }, () => createEmptySetDraft());
}

export function isValidTennisSet(
  winnerGames: number,
  loserGames: number,
): boolean {
  if (!Number.isInteger(winnerGames) || !Number.isInteger(loserGames)) {
    return false;
  }
  if (
    winnerGames < 0 ||
    loserGames < 0 ||
    winnerGames <= loserGames ||
    winnerGames > 7
  ) {
    return false;
  }
  if (winnerGames === 6 && loserGames <= 4) {
    return true;
  }
  if (winnerGames === 7 && (loserGames === 5 || loserGames === 6)) {
    return true;
  }
  return false;
}

export function parseSetScoreDraft(draft: SetScoreDraft):
  | { ok: true; score: [number, number] }
  | {
      ok: false;
      error: Exclude<MatchScoreDraftError, "setCount" | "invalidScore">;
    } {
  if (!draft.winnerGames.trim() || !draft.loserGames.trim()) {
    return { ok: false, error: "empty" };
  }

  const winnerGames = Number(draft.winnerGames);
  const loserGames = Number(draft.loserGames);
  if (!Number.isInteger(winnerGames) || !Number.isInteger(loserGames)) {
    return { ok: false, error: "invalidNumber" };
  }
  if (!isValidTennisSet(winnerGames, loserGames)) {
    return { ok: false, error: "invalidSet" };
  }

  return { ok: true, score: [winnerGames, loserGames] };
}

export function parseMatchScoreDrafts(
  drafts: SetScoreDraft[],
):
  | { ok: true; score: MatchScore }
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

  const score = { sets };
  const validated = matchScoreSchema.safeParse(score);
  if (!validated.success) {
    return { ok: false, error: "invalidScore" };
  }

  return { ok: true, score: validated.data };
}

export function formatMatchScore(score: MatchScore): string {
  return score.sets
    .map(([winnerGames, loserGames]) => `${winnerGames}-${loserGames}`)
    .join(", ");
}

export type MatchHubResult = {
  result_id: string;
  status: "submitted" | "confirmed" | "disputed" | "resolved";
  submitted_by: string;
  score: MatchScore;
  winner_user_id: string;
  confirmed_by?: string | null;
  dispute_note?: string | null;
};

export function canRecordAttendance(input: {
  matchStatus: string;
  viewerStatus: string | null;
  viewerAttendance: string;
}): boolean {
  return (
    input.matchStatus === "in_progress" &&
    input.viewerStatus === "accepted" &&
    input.viewerAttendance === "unknown"
  );
}

export function canSubmitResult(input: {
  matchStatus: string;
  viewerStatus: string | null;
  hasResult: boolean;
}): boolean {
  return (
    input.matchStatus === "in_progress" &&
    input.viewerStatus === "accepted" &&
    !input.hasResult
  );
}

export function canConfirmResult(input: {
  matchStatus: string;
  viewerStatus: string | null;
  viewerUserId: string;
  result: MatchHubResult | null;
}): boolean {
  return (
    input.matchStatus === "in_progress" &&
    input.viewerStatus === "accepted" &&
    input.result?.status === "submitted" &&
    input.result.submitted_by !== input.viewerUserId
  );
}

export function canDisputeResult(input: {
  matchStatus: string;
  viewerStatus: string | null;
  viewerUserId: string;
  result: MatchHubResult | null;
}): boolean {
  return canConfirmResult(input);
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
