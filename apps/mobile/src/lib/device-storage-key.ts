/**
 * Expo SecureStore only allows `[A-Za-z0-9._-]`. Keep this pure so unit tests
 * do not pull in react-native.
 */
export function toSecureStoreKey(key: string): string {
  const sanitized = key.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
  if (!sanitized) {
    throw new Error("SecureStore key must not be empty");
  }
  return sanitized.slice(0, 256);
}

export function deviceStorageKey(scope: string, userId: string): string {
  return `tennis-lebanon.${scope}.${userId}`;
}
