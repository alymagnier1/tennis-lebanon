export type HeroFamily = "green" | "light";

export const HERO_VARIANT_STORAGE_KEY = "tennis-lebanon.heroVariant";

/** Production default. Light (clay Welcome 5c + Done 2e) is a __DEV__ toggle. */
export const DEFAULT_HERO_FAMILY: HeroFamily = "green";

export function parseHeroFamily(value: string | null | undefined): HeroFamily {
  return value === "light" ? "light" : "green";
}
