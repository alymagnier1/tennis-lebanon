/**
 * i18n key prefixes that cover pilot-critical mobile surfaces.
 * Keep aligned with `packages/domain/src/critical-flows.ts`.
 */
export const CRITICAL_FLOW_KEY_PREFIXES = [
  "common.",
  "tabs.",
  "welcome.",
  "auth.",
  "onboarding.",
  "languages.",
  "formats.",
  "skillBands.",
  "skillBandsShort.",
  "playIntent.",
  "rating.",
  "discover.",
  "reports.",
  "matches.",
  "availability.",
  "clubs.",
  "settings.",
  "account.",
  "rtlCheck.",
] as const;

/** Substrings that must not appear in shipped Arabic/French copy. */
export const STALE_COPY_MARKERS = [
  "later milestone",
  "étape ultérieure",
  "مرحلة لاحقة",
  "TODO",
  "FIXME",
  "lorem ipsum",
  "coming soon",
] as const;

/** Keys where identical EN/AR text is acceptable (codes, acronyms). */
export const IDENTICAL_LOCALE_ALLOWLIST = new Set([
  "languages.en",
  "languages.ar",
  "languages.fr",
]);

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/** Flatten nested locale JSON to dotted leaf keys. */
export function flattenLocaleStrings(
  value: unknown,
  prefix = "",
): Record<string, string> {
  if (typeof value === "string") {
    return prefix ? { [prefix]: value } : {};
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (acc, [key, child]) => {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      return { ...acc, ...flattenLocaleStrings(child, childPrefix) };
    },
    {},
  );
}

export function isCriticalFlowKey(key: string): boolean {
  return CRITICAL_FLOW_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function containsArabicScript(value: string): boolean {
  return ARABIC_SCRIPT.test(value);
}

export function containsStaleCopyMarker(value: string): string | null {
  const lower = value.toLowerCase();
  for (const marker of STALE_COPY_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      return marker;
    }
  }
  return null;
}
