import type { DiscoveryFiltersInput } from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";
import type { MatchPreferredClub } from "./matches";

export type PlayerFavoriteClub = Pick<MatchPreferredClub, "club_id" | "name">;

export type NearTermAvailabilitySlot = {
  starts_at: string;
  ends_at: string;
};

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
  /** Earliest shared slot in the near-term window, if any. */
  overlap_starts_at: string | null;
  overlap_ends_at: string | null;
  bio: string | null;
  availability_weekdays: number[];
  availability_day_parts: Array<"morning" | "afternoon" | "evening">;
  /** Today + next two days in Asia/Beirut. */
  near_term_slots: NearTermAvailabilitySlot[];
  near_term_overlap_slots: NearTermAvailabilitySlot[];
  favorite_clubs: PlayerFavoriteClub[];
};

type DiscoverPlayerCardRow = Omit<
  CompatiblePlayerCard,
  | "availability_weekdays"
  | "availability_day_parts"
  | "near_term_slots"
  | "near_term_overlap_slots"
  | "favorite_clubs"
> & {
  availability_weekdays?: number[] | null;
  availability_day_parts?:
    CompatiblePlayerCard["availability_day_parts"] | null;
  near_term_slots?: NearTermAvailabilitySlot[] | null;
  near_term_overlap_slots?: NearTermAvailabilitySlot[] | null;
  favorite_clubs?: PlayerFavoriteClub[] | null;
};

function normalizeNearTermSlots(value: unknown): NearTermAvailabilitySlot[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((slot) => {
    if (!slot || typeof slot !== "object") return [];
    const record = slot as Record<string, unknown>;
    const startsAt = record.starts_at ?? record.startsAt;
    const endsAt = record.ends_at ?? record.endsAt;
    if (typeof startsAt !== "string" || typeof endsAt !== "string") {
      return [];
    }
    return [{ starts_at: startsAt, ends_at: endsAt }];
  });
}

function normalizeFavoriteClubs(value: unknown): PlayerFavoriteClub[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((club) => {
    if (!club || typeof club !== "object") return [];
    const record = club as Record<string, unknown>;
    const clubId = record.club_id;
    const name = record.name;
    if (typeof clubId !== "string" || typeof name !== "string") return [];
    return [{ club_id: clubId, name }];
  });
}

function normalizeDiscoverPlayerCard(
  row: DiscoverPlayerCardRow,
): CompatiblePlayerCard {
  return {
    ...row,
    availability_weekdays: row.availability_weekdays ?? [],
    availability_day_parts: row.availability_day_parts ?? [],
    near_term_slots: normalizeNearTermSlots(row.near_term_slots),
    near_term_overlap_slots: normalizeNearTermSlots(
      row.near_term_overlap_slots,
    ),
    favorite_clubs: normalizeFavoriteClubs(row.favorite_clubs),
  };
}

export type OpenMatchProposedTime = {
  id?: string;
  starts_at: string;
  ends_at: string;
};

function coerceIsoTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function normalizeOpenMatchProposedTimes(
  value: unknown,
): OpenMatchProposedTime[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((slot) => {
    if (!slot || typeof slot !== "object") return [];
    const record = slot as Record<string, unknown>;
    const startsAt = coerceIsoTimestamp(record.starts_at ?? record.startsAt);
    const endsAt = coerceIsoTimestamp(record.ends_at ?? record.endsAt);
    if (!startsAt || !endsAt) {
      return [];
    }
    const id = record.id;
    return [
      {
        id: typeof id === "string" ? id : undefined,
        starts_at: startsAt,
        ends_at: endsAt,
      },
    ];
  });
}

/** Earliest non-withdrawn proposed slot returned by discover. */
export function openMatchSoonestSlot(
  proposedTimes: OpenMatchProposedTime[],
): OpenMatchProposedTime | null {
  let best: OpenMatchProposedTime | null = null;
  for (const slot of proposedTimes) {
    if (!best || slot.starts_at < best.starts_at) {
      best = slot;
    }
  }
  return best;
}

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
  preferred_clubs: MatchPreferredClub[];
  proposed_times: OpenMatchProposedTime[];
  participant_count: number;
  capacity: number;
  creator_display_name: string;
  creator_avatar_path: string | null;
  notes: string | null;
  level_fit: boolean;
  zone_overlap: boolean;
  availability_overlap: boolean;
  created_at: string;
  /** The host secured a court before filling the roster. */
  court_secured: boolean;
  court_club_name: string | null;
};

type DiscoverOpenMatchCardRow = Omit<OpenMatchCard, "proposed_times"> & {
  proposed_times?: unknown;
};

function normalizeOpenMatchCard(row: DiscoverOpenMatchCardRow): OpenMatchCard {
  return {
    ...row,
    proposed_times: normalizeOpenMatchProposedTimes(row.proposed_times),
  };
}

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
    p_free_from: filters.freeFrom ?? undefined,
    p_free_to: filters.freeTo ?? undefined,
  });

  if (error) throw error;
  return ((data ?? []) as DiscoverPlayerCardRow[]).map(
    normalizeDiscoverPlayerCard,
  );
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
  return ((data ?? []) as DiscoverOpenMatchCardRow[]).map(
    normalizeOpenMatchCard,
  );
}

export async function getPublicPlayerCard(
  client: TennisSupabaseClient,
  userId: string,
): Promise<CompatiblePlayerCard> {
  const { data, error } = await client.rpc("get_public_player_card", {
    p_user_id: userId,
  });

  if (error) throw error;
  return normalizeDiscoverPlayerCard(data as DiscoverPlayerCardRow);
}
