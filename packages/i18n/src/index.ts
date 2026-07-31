import en from "./locales/en.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LOCALES = ["en", "ar", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Locales offered in the UI. Arabic translations are complete and stay under
 * CI key-parity guards, but the app never calls `I18nManager.forceRTL`, so
 * Arabic would render inside a left-to-right layout. Shipping that is worse
 * than shipping English and French, so it is withheld until native RTL lands.
 * See docs/DECISIONS.md.
 */
export const PILOT_LOCALES = [
  "en",
  "fr",
] as const satisfies readonly SupportedLocale[];
export type PilotLocale = (typeof PILOT_LOCALES)[number];

export function isPilotLocale(value: string): value is PilotLocale {
  return (PILOT_LOCALES as readonly string[]).includes(value);
}

export const DEFAULT_LOCALE: SupportedLocale = "en";

const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set(["ar"]);

export function isRtlLocale(locale: SupportedLocale): boolean {
  return RTL_LOCALES.has(locale);
}

export function getTextDirection(locale: SupportedLocale): "rtl" | "ltr" {
  return isRtlLocale(locale) ? "rtl" : "ltr";
}

/**
 * i18next-shaped resources: { [locale]: { translation: {...} } }.
 * Consumers pass this directly to i18next.init({ resources }).
 */
export const resources = {
  en: { translation: en },
  ar: { translation: ar },
  fr: { translation: fr },
} as const satisfies Record<SupportedLocale, { translation: unknown }>;

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
