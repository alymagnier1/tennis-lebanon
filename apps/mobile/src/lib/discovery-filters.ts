import {
  DEFAULT_DISCOVER_MATCH_TOGGLES,
  type DiscoverMatchToggles,
} from "@tennis-lebanon/domain";
import {
  deviceStorageKey,
  readDeviceValue,
  writeDeviceValue,
} from "./device-storage";

export type PersistedDiscoverFilters = {
  matchToggles?: Partial<DiscoverMatchToggles>;
};

/**
 * `v2` because `matchArea` changed meaning: it used to widen the search when on
 * and narrow it when off. A stored `true` was recorded under the old meaning, so
 * honouring it now would restrict a player who had asked for the opposite. The
 * old key is left to expire rather than migrated — there is nothing worth
 * translating in a value whose sense was reversed.
 */
function storageKey(userId: string): string {
  return deviceStorageKey("discover-filters.v2", userId);
}

export async function loadDiscoverFilters(
  userId: string,
): Promise<DiscoverMatchToggles> {
  const raw = await readDeviceValue(storageKey(userId));
  if (!raw) return { ...DEFAULT_DISCOVER_MATCH_TOGGLES };

  try {
    const parsed = JSON.parse(raw) as PersistedDiscoverFilters;
    const merged = {
      ...DEFAULT_DISCOVER_MATCH_TOGGLES,
      ...parsed.matchToggles,
    };
    // Drop legacy matchFormat if still present in older device storage.
    return {
      matchLevel: merged.matchLevel,
      matchIntent: merged.matchIntent,
      matchArea: merged.matchArea,
      matchAvailability: merged.matchAvailability,
    };
  } catch {
    return { ...DEFAULT_DISCOVER_MATCH_TOGGLES };
  }
}

export async function saveDiscoverFilters(
  userId: string,
  toggles: DiscoverMatchToggles,
): Promise<void> {
  await writeDeviceValue(
    storageKey(userId),
    JSON.stringify({
      matchToggles: toggles,
    } satisfies PersistedDiscoverFilters),
  );
}
