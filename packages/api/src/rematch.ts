import type { TennisSupabaseClient } from "./client";

/**
 * How much tennis two players have played together, and who is ahead.
 *
 * Win counts come from confirmed results only — an operator void writes
 * `resolved` and an unanswered score lands on `unverified`, neither of which
 * moved a rating, so neither may become a record about someone else.
 * `playedTogether` counts every completed match regardless, because attendance
 * is what completes a match and a scoreless casual hit still happened.
 */
export type RematchContext = {
  playedTogether: number;
  viewerWins: number;
  opponentWins: number;
  viewerTotalCompleted: number;
};

type RematchContextRow = {
  played_together: number;
  viewer_wins: number;
  opponent_wins: number;
  viewer_total_completed: number;
};

export async function getRematchContext(
  client: TennisSupabaseClient,
  opponentId: string,
): Promise<RematchContext> {
  const { data, error } = await client.rpc("get_rematch_context", {
    p_opponent_id: opponentId,
  });
  if (error) throw error;

  // `returns table` yields an array even though it is always one row.
  const row = (Array.isArray(data) ? data[0] : data) as
    RematchContextRow | undefined;

  return {
    playedTogether: row?.played_together ?? 0,
    viewerWins: row?.viewer_wins ?? 0,
    opponentWins: row?.opponent_wins ?? 0,
    viewerTotalCompleted: row?.viewer_total_completed ?? 0,
  };
}
