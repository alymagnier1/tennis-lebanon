import type {
  MatchScore,
  MatchHubResult as DomainMatchHubResult,
} from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";

export type MatchHubResult = DomainMatchHubResult;

export async function recordMatchAttendance(
  client: TennisSupabaseClient,
  matchId: string,
  attendance: "attended" | "no_show" | "late_cancel" | "cancelled_in_time",
): Promise<void> {
  const { error } = await client.rpc("record_match_attendance", {
    p_match_id: matchId,
    p_attendance: attendance,
  });
  if (error) {
    throw error;
  }
}

export async function submitMatchResult(
  client: TennisSupabaseClient,
  matchId: string,
  score: MatchScore,
  winnerUserId: string,
): Promise<string> {
  const { data, error } = await client.rpc("submit_match_result", {
    p_match_id: matchId,
    p_score: score,
    p_winner_user_id: winnerUserId,
  });
  if (error) {
    throw error;
  }
  return data as string;
}

export async function confirmMatchResult(
  client: TennisSupabaseClient,
  matchId: string,
): Promise<void> {
  const { error } = await client.rpc("confirm_match_result", {
    p_match_id: matchId,
  });
  if (error) {
    throw error;
  }
}

export async function disputeMatchResult(
  client: TennisSupabaseClient,
  matchId: string,
  note?: string,
): Promise<void> {
  const { error } = await client.rpc("dispute_match_result", {
    p_match_id: matchId,
    ...(note ? { p_note: note } : {}),
  });
  if (error) {
    throw error;
  }
}
