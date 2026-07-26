import type { TennisSupabaseClient } from "./client";

export type MatchMessageRow = {
  message_id: string;
  match_id: string;
  author_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
};

export async function listMatchMessages(
  client: TennisSupabaseClient,
  matchId: string,
  limit = 50,
): Promise<MatchMessageRow[]> {
  const { data, error } = await client.rpc("list_match_messages", {
    p_match_id: matchId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as MatchMessageRow[];
}

export async function sendMatchMessage(
  client: TennisSupabaseClient,
  matchId: string,
  body: string,
): Promise<string> {
  const { data, error } = await client.rpc("send_match_message", {
    p_match_id: matchId,
    p_body: body,
  });
  if (error) throw error;
  return data as string;
}
