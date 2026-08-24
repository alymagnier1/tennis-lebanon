import {
  APPEARANCE_STORAGE_KEY,
  parseAppearancePreference,
  type AppearancePreference,
} from "./appearance-preference";
import { readDeviceValue, writeDeviceValue } from "./device-storage";

export { APPEARANCE_STORAGE_KEY, parseAppearancePreference };

export async function readAppearancePreference(): Promise<AppearancePreference> {
  const stored = await readDeviceValue(APPEARANCE_STORAGE_KEY);
  return parseAppearancePreference(stored);
}

export async function persistAppearancePreference(
  preference: AppearancePreference,
): Promise<void> {
  await writeDeviceValue(APPEARANCE_STORAGE_KEY, preference);
}
