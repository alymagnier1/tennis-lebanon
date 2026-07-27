import type { TennisSupabaseClient } from "./client";

export type OwnPlayerProfile = {
  skill_band: string;
  play_intent: string;
  prefers_singles: boolean;
  prefers_doubles: boolean;
  internal_rating: number;
  rated_match_count: number;
};

export async function getOwnPlayerProfile(
  client: TennisSupabaseClient,
): Promise<OwnPlayerProfile> {
  const { data, error } = await client
    .from("player_profiles")
    .select(
      "skill_band, play_intent, prefers_singles, prefers_doubles, internal_rating, rated_match_count",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("Player profile not found");
  }

  return data;
}
