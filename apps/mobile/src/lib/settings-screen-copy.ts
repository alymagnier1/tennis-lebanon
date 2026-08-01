import type { TFunction } from "i18next";

const FALLBACKS = {
  settingsScreenGeneral: "General",
  settingsScreenLanguage: "Language",
  settingsScreenSupport: "Support",
  settingsScreenAccount: "Account",
} as const;

type SettingsScreenKey = keyof typeof FALLBACKS;

function tr(t: TFunction, key: SettingsScreenKey): string {
  const value = t(key);
  return value === key ? FALLBACKS[key] : value;
}

export function settingsScreenGeneralTitle(t: TFunction): string {
  return tr(t, "settingsScreenGeneral");
}

export function settingsScreenLanguageTitle(t: TFunction): string {
  return tr(t, "settingsScreenLanguage");
}

export function settingsScreenSupportTitle(t: TFunction): string {
  return tr(t, "settingsScreenSupport");
}

export function settingsScreenAccountTitle(t: TFunction): string {
  return tr(t, "settingsScreenAccount");
}
