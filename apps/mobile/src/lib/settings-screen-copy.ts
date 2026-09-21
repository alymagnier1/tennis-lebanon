import type { TFunction } from "i18next";

const FALLBACKS = {
  settingsScreenPreferences: "Preferences",
  settingsScreenLanguage: "Language",
  settingsScreenAppearance: "Appearance",
  settingsScreenAccount: "Account",
} as const;

type SettingsScreenKey = keyof typeof FALLBACKS;

function tr(t: TFunction, key: SettingsScreenKey): string {
  const value = t(key);
  return value === key ? FALLBACKS[key] : value;
}

export function settingsScreenPreferencesTitle(t: TFunction): string {
  return tr(t, "settingsScreenPreferences");
}

export function settingsScreenLanguageTitle(t: TFunction): string {
  return tr(t, "settingsScreenLanguage");
}

export function settingsScreenAppearanceTitle(t: TFunction): string {
  return tr(t, "settingsScreenAppearance");
}

export function settingsScreenAccountTitle(t: TFunction): string {
  return tr(t, "settingsScreenAccount");
}
