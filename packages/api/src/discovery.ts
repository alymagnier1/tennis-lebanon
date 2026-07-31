import type { DiscoveryFiltersInput } from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";

export type CompatiblePlayerCard = {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  skill_band: string;
  play_intent: string;
  prefers_singles: boolean;
  prefers_doubles: boolean;
  zones: unknown;
  provisional_rating_label: string;
  display_rating: number | null;
  completed_match_count: number;
  level_fit: boolean;
  zone_overlap: boolean;
  availability_overlap: boolean;
  intent_fit: boolean;
  format_fit: boolean;
  /** Earliest hour-or-longer slot both players are free, if any. */
  overlap_starts_at: string | null;
  overlap_ends_at: string | null;
};

export type OpenMatchCard = {
  match_id: string;
  format: string;
  intent: string;
  visibility: string;
  status: string;
  requires_creator_approval: boolean;
  min_skill: string;
  max_skill: string;
  zones: unknown;
  proposed_times: unknown;
  participant_count: number;
  capacity: number;
  creator_display_name: string;
  creator_avatar_path: string | null;
  notes: string | null;
  level_fit: boolean;
  zone_overlap: boolean;
  availability_overlap: boolean;
  created_at: string;
};

export async function discoverCompatiblePlayers(
  client: TennisSupabaseClient,
  filters: DiscoveryFiltersInput = {},
  cursorUserId?: string | null,
): Promise<CompatiblePlayerCard[]> {
  const { data, error } = await client.rpc("discover_compatible_players", {
    p_zone_ids:
      filters.zoneIds && filters.zoneIds.length > 0
        ? filters.zoneIds
        : undefined,
    p_format: filters.format ?? undefined,
    p_intent: filters.intent ?? undefined,
    p_require_availability_overlap: filters.requireAvailabilityOverlap ?? false,
    p_horizon_days: filters.horizonDays ?? 14,
    p_level_window: filters.levelWindow ?? 1,
    p_limit: filters.limit ?? 20,
    p_cursor_user_id: cursorUserId ?? undefined,
  });

  if (error) throw error;
  return (data ?? []) as CompatiblePlayerCard[];
}

export async function discoverOpenMatches(
  client: TennisSupabaseClient,
  filters: DiscoveryFiltersInput = {},
  cursorCreatedAt?: string | null,
): Promise<OpenMatchCard[]> {
  const { data, error } = await client.rpc("discover_open_matches", {
    p_zone_ids:
      filters.zoneIds && filters.zoneIds.length > 0
        ? filters.zoneIds
        : undefined,
    p_format: filters.format ?? undefined,
    p_intent: filters.intent ?? undefined,
    p_horizon_days: filters.horizonDays ?? 14,
    p_limit: filters.limit ?? 20,
    p_cursor_created_at: cursorCreatedAt ?? undefined,
  });

  if (error) throw error;
  return (data ?? []) as OpenMatchCard[];
}

export async function getPublicPlayerCard(
  client: TennisSupabaseClient,
  userId: string,
): Promise<CompatiblePlayerCard> {
  const { data, error } = await client.rpc("get_public_player_card", {
    p_user_id: userId,
  });

  if (error) throw error;
  return data as CompatiblePlayerCard;
}
