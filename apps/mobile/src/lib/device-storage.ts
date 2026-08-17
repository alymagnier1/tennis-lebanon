import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Small per-device key/value store: SecureStore on native, localStorage on web.
 *
 * The same two helpers already exist privately inside `discovery-filters.ts`.
 * They are re-homed here rather than imported from there because that file has
 * unrelated changes in flight; once it lands, it should import these instead of
 * keeping its own copies.
 */

export function deviceStorageKey(scope: string, userId: string): string {
  return `tennis-lebanon:${scope}:${userId}`;
}

export async function readDeviceValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function writeDeviceValue(
  key: string,
  value: string,
): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
