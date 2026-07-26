import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { PlayIntent } from "@tennis-lebanon/domain";

export type PersistedDiscoverFilters = {
  zoneIds?: string[];
  useWidenedZones?: boolean;
  format?: "singles" | "doubles" | null;
  intent?: PlayIntent | null;
  requireAvailabilityOverlap?: boolean;
  levelWindow?: number;
};

function storageKey(userId: string): string {
  return `tennis-lebanon:discover-filters:${userId}`;
}

async function readValue(key: string): Promise<string | null> {
  if (Platform.OS === "web")
    return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function writeValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function loadDiscoverFilters(
  userId: string,
): Promise<PersistedDiscoverFilters | null> {
  const raw = await readValue(storageKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedDiscoverFilters;
  } catch {
    return null;
  }
}

export async function saveDiscoverFilters(
  userId: string,
  filters: PersistedDiscoverFilters,
): Promise<void> {
  await writeValue(storageKey(userId), JSON.stringify(filters));
}
