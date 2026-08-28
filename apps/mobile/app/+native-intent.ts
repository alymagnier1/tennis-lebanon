import { rewriteExpoGoAuthPath } from "../src/lib/auth-url";

/**
 * Expo Go cannot open `tennislebanon://`. Incoming `exp://` links often encode
 * the auth hash into the path (`/auth/callback%23...`), which expo-router then
 * reports as Unmatched Route. Rewrite that to `/auth/callback?...`.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  return rewriteExpoGoAuthPath(path);
}
