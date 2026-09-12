import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { deviceStorageKey, toSecureStoreKey } from "./device-storage-key";

export { deviceStorageKey, toSecureStoreKey };

/**
 * Small per-device key/value store: SecureStore on native, localStorage on web.
 *
 * Expo SecureStore only allows `[A-Za-z0-9._-]`. Older keys used `:`, which
 * throws on native (and surfaces as an uncaught promise on Expo Go). Sanitize
 * on the native path so callers can keep readable names.
 */

export async function readDeviceValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(toSecureStoreKey(key));
}

export async function writeDeviceValue(
  key: string,
  value: string,
): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(toSecureStoreKey(key), value);
}

export async function removeDeviceValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(toSecureStoreKey(key));
}
