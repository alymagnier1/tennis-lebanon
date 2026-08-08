import en from "./locales/en.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LOCALES = ["en", "ar", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Locales offered in the language picker. Arabic is included now that native
 * RTL is wired through `syncNativeLayoutDirection` on the mobile app.
 */
export const PILOT_LOCALES = [
  "en",
  "fr",
  "ar",
] as const satisfies readonly SupportedLocale[];
export type PilotLocale = (typeof PILOT_LOCALES)[number];

export function isPilotLocale(value: string): value is PilotLocale {
  return (PILOT_LOCALES as readonly string[]).includes(value);
}

export const DEFAULT_LOCALE: SupportedLocale = "en";

/** Changes when locale JSON changes — imported by mobile to refresh Metro bundles. */
export const LOCALE_BUNDLE_ID = "2026-08-08-skill-band-carousel";

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
