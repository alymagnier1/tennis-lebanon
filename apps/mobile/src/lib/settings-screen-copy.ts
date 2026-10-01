import type { TFunction } from "i18next";

const FALLBACKS = {
  settingsScreenPreferences: "Preferences",
  // The app's display language; "Languages you speak" on Edit profile is a
  // different setting, and the same bare word made them look like duplicates.
  settingsScreenLanguage: "App language",
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

/**
 * How the account signs in, for Settings' "Signed in with …" row. Read from
 * the providers linked to the account: one created with Google may also have
 * a password, and still reads as a Google account.
 */
export function settingsSignInMethod(providers: unknown): "google" | "email" {
  return Array.isArray(providers) && providers.includes("google")
    ? "google"
    : "email";
}
