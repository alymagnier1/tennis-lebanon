import type {
  UpdatePreferredZonesInput,
  UpdateTennisPreferencesInput,
} from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";

export type OwnPlayerProfile = {
  skill_band: string;
  play_intent: string;
  prefers_singles: boolean;
  prefers_doubles: boolean;
  internal_rating: number;
  rated_match_count: number;
  bio: string | null;
  display_name: string;
  languages: string[];
};

export async function getOwnPlayerProfile(
  client: TennisSupabaseClient,
): Promise<OwnPlayerProfile> {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("display_name, languages")
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { data, error } = await client
    .from("player_profiles")
    .select(
      "skill_band, play_intent, prefers_singles, prefers_doubles, internal_rating, rated_match_count, bio",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data || !profile) {
    throw new Error("Player profile not found");
  }

  return {
    ...data,
    display_name: profile.display_name ?? "",
    languages: profile.languages ?? [],
  };
}

export async function updateOwnProfile(
  client: TennisSupabaseClient,
  input: {
    displayName: string;
    languages: string[];
    bio?: string;
  },
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    throw new Error("Authentication required");
  }

  const { error: profileError } = await client
    .from("profiles")
    .update({
      display_name: input.displayName,
      languages: input.languages,
    })
    .eq("id", user.id);

  if (profileError) {
    throw profileError;
  }

  const { error: playerError } = await client
    .from("player_profiles")
    .update({ bio: input.bio ?? null })
    .eq("user_id", user.id);

  if (playerError) {
    throw playerError;
  }
}

export type PublicPlayerAvailabilitySummary = {
  weekdays: number[];
  day_parts: Array<"morning" | "afternoon" | "evening">;
};

export type PublicPlayerRecentMatch = {
  opponent_names: string | null;
  player_won: boolean;
  score: unknown;
  played_at: string | null;
};

export async function getPublicPlayerAvailabilitySummary(
  client: TennisSupabaseClient,
  userId: string,
): Promise<PublicPlayerAvailabilitySummary> {
  const { data, error } = await client.rpc(
    "get_public_player_availability_summary",
    { p_user_id: userId },
  );

  if (error) throw error;

  const summary = (data ?? { weekdays: [], day_parts: [] }) as {
    weekdays?: number[];
    day_parts?: PublicPlayerAvailabilitySummary["day_parts"];
  };

  return {
    weekdays: summary.weekdays ?? [],
    day_parts: summary.day_parts ?? [],
  };
}

export async function listPublicPlayerRecentMatches(
  client: TennisSupabaseClient,
  userId: string,
  limit = 5,
): Promise<PublicPlayerRecentMatch[]> {
  const { data, error } = await client.rpc(
    "list_public_player_recent_matches",
    {
      p_user_id: userId,
      p_limit: limit,
    },
  );

  if (error) throw error;
  return (data ?? []) as PublicPlayerRecentMatch[];
}

export async function updateTennisPreferences(
  client: TennisSupabaseClient,
  input: UpdateTennisPreferencesInput,
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    throw new Error("Authentication required");
  }

  const { error } = await client
    .from("player_profiles")
    .update({
      play_intent: input.playIntent,
      prefers_singles: input.prefersSingles,
      prefers_doubles: input.prefersDoubles,
    })
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

export async function listOwnPreferredZoneIds(
  client: TennisSupabaseClient,
): Promise<string[]> {
  const { data, error } = await client
    .from("player_zones")
    .select("zone_id")
    .order("priority");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.zone_id);
}

export async function updatePreferredZones(
  client: TennisSupabaseClient,
  input: UpdatePreferredZonesInput,
): Promise<void> {
  const { error } = await client.rpc("set_player_preferred_zones", {
    p_zone_ids: input.zoneIds,
  });

  if (error) {
    throw error;
  }
}
