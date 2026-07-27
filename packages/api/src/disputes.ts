import type { DisputeResolution } from "@tennis-lebanon/domain";
import { formatDisputeScore as formatDisputeScoreFromDomain } from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";

export type DisputedResultQueueRow = {
  result_id: string;
  match_id: string;
  status: string;
  score: { sets: [number, number][] };
  winner_user_id: string;
  winner_name: string;
  submitted_by: string;
  submitted_by_name: string;
  dispute_note: string | null;
  disputed_at: string;
  match_format: string;
};

export async function isPlatformOperator(
  client: TennisSupabaseClient,
): Promise<boolean> {
  const { data, error } = await client.rpc("is_platform_operator");
  if (error) {
    throw error;
  }
  return Boolean(data);
}

export async function listDisputedResults(
  client: TennisSupabaseClient,
  limit = 50,
): Promise<DisputedResultQueueRow[]> {
  const { data, error } = await client.rpc("list_disputed_results", {
    p_limit: limit,
  });
  if (error) {
    throw error;
  }
  return (data ?? []) as DisputedResultQueueRow[];
}

export async function resolveMatchResultDispute(
  client: TennisSupabaseClient,
  resultId: string,
  resolution: DisputeResolution,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc("resolve_match_result_dispute", {
    p_result_id: resultId,
    p_resolution: resolution,
    p_reason: reason,
  });
  if (error) {
    throw error;
  }
}

export function formatDisputeScore(score: { sets: [number, number][] }): string {
  return formatDisputeScoreFromDomain(score);
}
