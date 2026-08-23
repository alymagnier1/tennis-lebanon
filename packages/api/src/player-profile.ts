import type {
  SetOwnGenderInput,
  SetOwnSkillBandInput,
  UpdateMatchHostDefaultsInput,
  UpdatePreferredZonesInput,
} from "@tennis-lebanon/domain";
import {
  updateInputToDbPatch,
  updateMatchHostDefaultsSchema,
} from "@tennis-lebanon/domain";
import type { TennisSupabaseClient } from "./client";

const PLAYER_PROFILE_BASE_SELECT =
  "skill_band, play_intent, prefers_singles, prefers_doubles, internal_rating, rated_match_count, bio";

const PLAYER_PROFILE_EXTENDED_SELECT = `${PLAYER_PROFILE_BASE_SELECT}, default_match_visibility, default_requires_creator_approval, default_min_skill, default_max_skill, default_match_format, match_defaults_set_at`;

const MATCH_HOST_DEFAULTS_FALLBACK = {
  default_match_visibility: "public",
  default_requires_creator_approval: false,
  default_min_skill: null,
  default_max_skill: null,
  default_match_format: null,
  match_defaults_set_at: null,
} as const;

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
  default_match_visibility: string;
  default_requires_creator_approval: boolean;
  default_min_skill: string | null;
  default_max_skill: string | null;
  default_match_format: string | null;
  match_defaults_set_at: string | null;
  /** False when migration 053 columns are not on the connected database yet. */
  match_host_defaults_available: boolean;
};

function isMissingMatchHostDefaultsColumnsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  const code = "code" in error ? String(error.code) : "";
  return (
    code === "42703" ||
    message.includes("default_match_visibility") ||
    message.includes("match_defaults_set_at")
  );
}

type PlayerProfileBaseRow = {
  skill_band: string;
  play_intent: string;
  prefers_singles: boolean;
  prefers_doubles: boolean;
  internal_rating: number;
  rated_match_count: number;
  bio: string | null;
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

  const extended = await client
    .from("player_profiles")
    .select(PLAYER_PROFILE_EXTENDED_SELECT)
    .maybeSingle();

  if (!extended.error && extended.data && profile) {
    return {
      ...extended.data,
      display_name: profile.display_name ?? "",
      languages: profile.languages ?? [],
      match_host_defaults_available: true,
    };
  }

  if (
    extended.error &&
    !isMissingMatchHostDefaultsColumnsError(extended.error)
  ) {
    throw extended.error;
  }

  const base = await client
    .from("player_profiles")
    .select(PLAYER_PROFILE_BASE_SELECT)
    .maybeSingle();

  if (base.error) {
    throw base.error;
  }
  if (!base.data || !profile) {
    throw new Error("Player profile not found");
  }

  return {
    ...(base.data as PlayerProfileBaseRow),
    ...MATCH_HOST_DEFAULTS_FALLBACK,
    display_name: profile.display_name ?? "",
    languages: profile.languages ?? [],
    match_host_defaults_available: false,
  };
}

/**
 * Write only the bio.
 *
 * `updateOwnProfile` writes `profiles` and `player_profiles` together, which is
 * right for the edit form and wrong for the About box: sending an unchanged
 * display name with every bio save made the bio depend on permission to rewrite
 * identity, and that is exactly how it broke -- `profiles` had no UPDATE grant,
 * so saving a bio failed on a column the player had not touched.
 */
export async function updateOwnBio(
  client: TennisSupabaseClient,
  bio: string | null,
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

  const trimmed = bio?.trim();
  const { error } = await client
    .from("player_profiles")
    .update({ bio: trimmed ? trimmed : null })
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
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

export type PublicPlayerAvailabilityDayPart =
  "morning" | "afternoon" | "evening";

export type PublicPlayerAvailabilityWeekdaySummary = {
  weekday: number;
  day_parts: PublicPlayerAvailabilityDayPart[];
};

export type PublicPlayerAvailabilitySummary = {
  weekdays: number[];
  day_parts: PublicPlayerAvailabilityDayPart[];
  by_weekday: PublicPlayerAvailabilityWeekdaySummary[];
};

export type PublicPlayerRecentMatch = {
  opponent_names: string | null;
  player_won: boolean;
  /** Which side of the stored score this player was on, so it reads their way. */
  player_side: 1 | 2;
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

  const summary = (data ?? {
    weekdays: [],
    day_parts: [],
    by_weekday: [],
  }) as {
    weekdays?: number[];
    day_parts?: PublicPlayerAvailabilitySummary["day_parts"];
    by_weekday?: PublicPlayerAvailabilityWeekdaySummary[];
  };

  return {
    weekdays: summary.weekdays ?? [],
    day_parts: summary.day_parts ?? [],
    by_weekday: summary.by_weekday ?? [],
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

export async function updateMatchHostDefaults(
  client: TennisSupabaseClient,
  input: UpdateMatchHostDefaultsInput,
): Promise<void> {
  const parsed = updateMatchHostDefaultsSchema.parse(input);

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

  const patch = updateInputToDbPatch(parsed);
  const now = new Date().toISOString();

  const existing = await client
    .from("player_profiles")
    .select("match_defaults_set_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    existing.error &&
    !isMissingMatchHostDefaultsColumnsError(existing.error)
  ) {
    throw existing.error;
  }

  const { error } = await client
    .from("player_profiles")
    .update({
      ...patch,
      match_defaults_set_at: existing.data?.match_defaults_set_at ?? now,
    })
    .eq("user_id", user.id);

  if (error && isMissingMatchHostDefaultsColumnsError(error)) {
    const { error: legacyError } = await client
      .from("player_profiles")
      .update({
        play_intent: patch.play_intent,
        prefers_singles: patch.prefers_singles,
        prefers_doubles: patch.prefers_doubles,
      })
      .eq("user_id", user.id);

    if (legacyError) {
      throw legacyError;
    }
    return;
  }

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

export async function listOwnFavoriteClubIds(
  client: TennisSupabaseClient,
): Promise<string[]> {
  const { data, error } = await client
    .from("player_favorite_clubs")
    .select("club_id");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.club_id);
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

const AVATAR_BUCKET = "avatars";

/**
 * Points the profile at an uploaded object, or clears it when given null.
 * Returns the path this replaced, if any, for the caller to clean up.
 */
export async function setOwnAvatar(
  client: TennisSupabaseClient,
  avatarPath: string | null,
): Promise<string | null> {
  // Omitted rather than passed as null: the RPC defaults the argument, and
  // that is what makes "clear my photo" expressible without casting away the
  // generated non-null parameter type.
  const { data, error } = await client.rpc(
    "set_own_avatar",
    avatarPath === null ? {} : { p_avatar_path: avatarPath },
  );

  if (error) {
    throw error;
  }

  return data ?? null;
}

/** Removes the stored object too, so clearing a photo does not leave it behind. */
export async function clearOwnAvatar(
  client: TennisSupabaseClient,
): Promise<void> {
  const replacedPath = await setOwnAvatar(client, null);

  if (replacedPath) {
    await client.storage
      .from(AVATAR_BUCKET)
      .remove([replacedPath])
      .catch(() => undefined);
  }
}

/**
 * Uploads already-decoded image bytes and points the profile at them.
 *
 * Takes bytes rather than a URI on purpose: this package is shared by the Expo
 * app and the Next.js dashboard and compiles without the DOM lib, so reading a
 * local file belongs to whichever platform knows how. The bucket enforces the
 * size cap and MIME allowlist, and set_own_avatar re-checks the path server
 * side, so nothing here is load-bearing for authorization.
 */
export async function uploadOwnAvatar(
  client: TennisSupabaseClient,
  imageBytes: ArrayBuffer,
  contentType = "image/jpeg",
): Promise<string> {
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

  const storagePath = `${user.id}/${Date.now()}.jpg`;

  const { error: uploadError } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, imageBytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const replacedPath = await setOwnAvatar(client, storagePath);

  // The profile already points at the new object, so a failure to tidy up the
  // old one is not worth failing the upload over. Storage RLS confines this to
  // the caller's own folder, and the path came from the server, not the client.
  if (replacedPath) {
    await client.storage
      .from(AVATAR_BUCKET)
      .remove([replacedPath])
      .catch(() => undefined);
  }

  return storagePath;
}

export async function setOwnGender(
  client: TennisSupabaseClient,
  gender: SetOwnGenderInput["gender"],
): Promise<void> {
  const { error } = await client.rpc("set_own_gender", {
    p_gender: gender ?? undefined,
  });

  if (error) {
    throw error;
  }
}

export async function setOwnSkillBand(
  client: TennisSupabaseClient,
  skillBand: SetOwnSkillBandInput["skillBand"],
): Promise<void> {
  const { error } = await client.rpc("set_own_skill_band", {
    p_skill_band: skillBand,
  });

  if (error) {
    throw error;
  }
}
