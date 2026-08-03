import type { Href } from "expo-router";
import type { AccessState } from "./access-state";

/**
 * Public-stack guard: signed-in users are normally sent to their canonical route,
 * but sign-in stays reachable while onboarding is incomplete so they can switch
 * accounts instead of bouncing consent ↔ sign-in.
 */
export function publicRouteRedirect(
  state: AccessState,
  routeName: string | undefined,
): Href | null {
  if (state === "anonymous" || state === "error" || state === "loading") {
    return null;
  }
  if (state === "needsOnboarding" && routeName === "sign-in") {
    return null;
  }
  return authRouteForState(state);
}

/** Canonical post-auth destination for a resolved access state. */
export function authRouteForState(state: AccessState): Href | null {
  switch (state) {
    case "anonymous":
      return "/(public)/welcome";
    case "needsOnboarding":
      return "/(onboarding)/consent";
    case "ready":
      return "/(tabs)";
    case "suspended":
    case "deletionRequested":
      return "/(auth)/account-unavailable";
    case "loading":
    case "error":
      return null;
  }
}
