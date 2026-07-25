import type { Href } from "expo-router";
import type { AccessState } from "./access-state";

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
