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
