import type { Json } from "@tennis-lebanon/types";

type ZoneLike = {
  name_i18n?: Record<string, string>;
  slug?: string;
};

export function zoneNameFromJson(names: Json, locale: string): string {
  if (names && typeof names === "object" && !Array.isArray(names)) {
    const localized = names[locale];
    const english = names.en;
    if (typeof localized === "string") return localized;
    if (typeof english === "string") return english;
  }
  return "";
}

export function zoneLabelFromList(zones: unknown, locale: string): string {
  if (!Array.isArray(zones) || zones.length === 0) return "";
  const labels = zones
    .map((zone) => {
      const entry = zone as ZoneLike;
      return (
        entry.name_i18n?.[locale] ??
        entry.name_i18n?.en ??
        entry.slug ??
        ""
      );
    })
    .filter(Boolean);
  return labels.join(" · ");
}
