import type { Href } from "expo-router";
import { router } from "expo-router";

export const MATCHES_TAB_ROUTE = "/(tabs)/matches" as Href;

/** Leave the match hub when history may be empty (e.g. after create via replace). */
export function exitMatchHub(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(MATCHES_TAB_ROUTE);
}
