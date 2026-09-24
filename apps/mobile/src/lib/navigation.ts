import type { Href } from "expo-router";
import { router } from "expo-router";
import { CLUBS_ROUTE } from "./routes";

export const MATCHES_TAB_ROUTE = "/(tabs)/matches" as Href;
export const PROFILE_TAB_ROUTE = "/(tabs)/profile" as Href;
export const SETTINGS_TAB_ROUTE = "/(tabs)/settings" as Href;
export const DISCOVER_TAB_ROUTE = "/(tabs)/discover" as Href;
export const WELCOME_ROUTE = "/(public)/welcome" as Href;
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

/**
 * Leave sign-in, sign-up or forgot-password when history may be empty.
 *
 * `welcome` pushes into these, so there is usually something to pop. There is
 * not when the screen is the first thing rendered: `PublicLayout` redirects
 * rather than pushes, and an emailed confirm or reset link cold-starts the app
 * straight onto a route with no history. A bare `router.back()` there is a
 * no-op that logs "GO_BACK was not handled by any navigator" in development
 * and silently does nothing in production -- a back button that never works.
 */
export function exitAuthScreen(): void {
  goBackOrReplace(WELCOME_ROUTE);
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
