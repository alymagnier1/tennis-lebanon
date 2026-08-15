import type { Href } from "expo-router";
import { router } from "expo-router";
import { CLUBS_ROUTE } from "./routes";

export const MATCHES_TAB_ROUTE = "/(tabs)/matches" as Href;
export const PROFILE_TAB_ROUTE = "/(tabs)/profile" as Href;
export const SETTINGS_TAB_ROUTE = "/(tabs)/settings" as Href;
export const DISCOVER_TAB_ROUTE = "/(tabs)/discover" as Href;
export const CLUBS_TAB_ROUTE = CLUBS_ROUTE;

/** Leave the match hub when history may be empty (e.g. after create via replace). */
export function exitMatchHub(): void {
  goBackOrReplace(MATCHES_TAB_ROUTE);
}

/** Leave profile sub-screens (availability, edit) when history may be empty. */
export function exitProfileScreen(): void {
  goBackOrReplace(PROFILE_TAB_ROUTE);
}

/** Leave a public player profile (Discover is the usual entry). */
export function exitPlayerProfile(): void {
  goBackOrReplace(DISCOVER_TAB_ROUTE);
}

/** Leave club detail when history may be empty (deep link / refresh). */
export function exitClubDetail(): void {
  goBackOrReplace(CLUBS_TAB_ROUTE);
}

export function goBackOrReplace(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
