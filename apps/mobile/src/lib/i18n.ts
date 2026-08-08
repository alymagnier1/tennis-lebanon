import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LOCALE,
  isPilotLocale,
  isSupportedLocale,
  LOCALE_BUNDLE_ID,
  resources,
  type PilotLocale,
  type SupportedLocale,
} from "@tennis-lebanon/i18n";
import { syncNativeLayoutDirection } from "./layout-rtl";

const LOCALE_STORAGE_KEY = "tennis-lebanon.locale";

const i18next = createInstance();

// Tie mobile bundle to locale JSON so Metro reloads workspace i18n edits.
void LOCALE_BUNDLE_ID;

i18next.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

async function readStoredLocale(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) ?? null;
    }
    return await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the chosen language. Without this the app re-initialised to English
 * on every launch, so a French user had to re-select it each time.
 */
export async function persistLocale(locale: PilotLocale): Promise<void> {
  await i18next.changeLanguage(locale);
  await syncNativeLayoutDirection(locale);
  try {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
      return;
    }
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
  } catch {
    // A failed write only costs the preference on next launch.
  }
}

/**
 * i18next initialises synchronously, so the stored choice is applied straight
 * after. Only pilot locales are restored: a stored Arabic preference from an
 * earlier build must not bring back an unmirrored layout.
 */
export const localeReady: Promise<void> = (async () => {
  const stored = await readStoredLocale();
  if (stored && isPilotLocale(stored) && stored !== i18next.language) {
    await i18next.changeLanguage(stored);
  }
  const active = i18next.language;
  if (isSupportedLocale(active)) {
    await syncNativeLayoutDirection(active);
  }
})();

export { i18next };
