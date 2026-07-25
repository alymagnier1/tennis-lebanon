import en from "./locales/en.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LOCALES = ["en", "ar", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

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
