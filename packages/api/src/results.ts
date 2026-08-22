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
  note?: string,
): Promise<void> {
  const { error } = await client.rpc("record_match_attendance", {
    p_match_id: matchId,
    p_attendance: attendance,
    p_note: note?.trim() ? note.trim().slice(0, 200) : undefined,
  });
  if (error) {
    throw error;
  }
}

/**
 * Say this match had no score to record, or take that back with `declined`
 * false. Per participant, not per match: it never speaks for the other player,
 * who can still submit a real score afterwards.
 */
export async function declineMatchScore(
  client: TennisSupabaseClient,
  matchId: string,
  declined = true,
): Promise<string | null> {
  const { data, error } = await client.rpc("decline_match_score", {
    p_match_id: matchId,
    p_declined: declined,
  });
  if (error) {
    throw error;
  }
  return data ?? null;
}

/** When the viewer said this match had no score, or null if they have not. */
export async function getOwnScoreDeclined(
  client: TennisSupabaseClient,
  matchId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc("get_own_score_declined", {
    p_match_id: matchId,
  });
  if (error) {
    throw error;
  }
  return data ?? null;
}

/**
 * `sideAUserIds` names one side; the server derives the other, validates the
 * score, and works out who won from it. There is deliberately no winner
 * parameter — a caller reaching past the app can no longer name themselves the
 * winner of a match they lost.
 */
export async function submitMatchResult(
  client: TennisSupabaseClient,
  matchId: string,
  score: MatchScore,
  sideAUserIds: string[],
): Promise<string> {
  const { data, error } = await client.rpc("submit_match_result", {
    p_match_id: matchId,
    p_score: score,
    p_side_a_user_ids: sideAUserIds,
  });
  if (error) {
    throw error;
  }
  return data as string;
}

/** Available once to whoever disputed, and only before the first reopen. */
export async function resubmitMatchResult(
  client: TennisSupabaseClient,
  matchId: string,
  score: MatchScore,
  sideAUserIds: string[],
): Promise<void> {
  const { error } = await client.rpc("resubmit_match_result", {
    p_match_id: matchId,
    p_score: score,
    p_side_a_user_ids: sideAUserIds,
  });
  if (error) {
    throw error;
  }
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
