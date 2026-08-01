import type { Href } from "expo-router";
import { router } from "expo-router";

export const MATCHES_TAB_ROUTE = "/(tabs)/matches" as Href;
export const PROFILE_TAB_ROUTE = "/(tabs)/profile" as Href;

/** Leave the match hub when history may be empty (e.g. after create via replace). */
export function exitMatchHub(): void {
  goBackOrReplace(MATCHES_TAB_ROUTE);
}

/** Leave profile sub-screens (availability, edit) when history may be empty. */
export function exitProfileScreen(): void {
  goBackOrReplace(PROFILE_TAB_ROUTE);
}

export function goBackOrReplace(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
