import type {
  AppearancePreference,
  ResolvedAppearance,
} from "../theme/tennis-tokens";
import { resolveAppearance } from "../theme/tennis-tokens";

export type { AppearancePreference };

export const APPEARANCE_STORAGE_KEY = "tennis-lebanon:appearance";

export function parseAppearancePreference(
  value: string | null,
): AppearancePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function appearanceFromSystem(
  preference: AppearancePreference,
  systemColorScheme: string | null | undefined,
): ResolvedAppearance {
  const system: ResolvedAppearance =
    systemColorScheme === "dark" ? "dark" : "light";
  return resolveAppearance(preference, system);
}
