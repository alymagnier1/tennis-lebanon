import type { AppearancePreference } from "../theme/tennis-tokens";

export type { AppearancePreference };

/** Must stay SecureStore-safe: alphanumeric, `.`, `-`, `_` only. */
export const APPEARANCE_STORAGE_KEY = "tennis-lebanon.appearance";

export function parseAppearancePreference(
  value: string | null,
): AppearancePreference {
  // A stored "system" (the removed option) and a first launch read as Light.
  return value === "dark" ? "dark" : "light";
}
