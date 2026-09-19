import type { Href } from "expo-router";
import type { AccessState } from "./access-state";
import { isPasswordRecoveryPending } from "./password-recovery";

const SWITCH_ACCOUNT_ROUTES = new Set([
  "sign-in",
  "sign-up",
  "forgot-password",
]);

/**
 * Public-stack guard: signed-in users are normally sent to their canonical route,
 * but the auth forms stay reachable while onboarding is incomplete so they can
 * switch accounts instead of bouncing consent ↔ sign-in.
 */
export function publicRouteRedirect(
  state: AccessState,
  routeName: string | undefined,
): Href | null {
  if (state === "anonymous" || state === "error" || state === "loading") {
    return null;
  }
  if (isPasswordRecoveryPending()) {
    return "/(auth)/update-password";
  }
  if (
    state === "needsOnboarding" &&
    routeName &&
    SWITCH_ACCOUNT_ROUTES.has(routeName)
  ) {
    return null;
  }
  return authRouteForState(state);
}

/**
 * Auth-stack guard, mirroring `publicRouteRedirect` so both groups decide the
 * same way and both can be tested without rendering a layout.
 *
 * Most of this stack is *for* signed-out people -- `verify-code` after
 * sign-up, `callback` on a deep link -- so a signed-in player is sent on to
 * their canonical route.
 *
 * `update-password` is the exception, and a signed-in player reaches it from
 * two directions: recovery routes here, and settings sends a Google-created
 * account here to set its first password. Only the first was accounted for,
 * and it worked by accident -- during recovery `authRouteForState` returns
 * this very route, so the comparison below matched. From settings it returns
 * `/(tabs)`, so tapping Set a password bounced straight back to the tabs.
 */
export function authGroupRedirect(
  state: AccessState,
  routeName: string | undefined,
): Href | null {
  // Signing out of `account-unavailable` otherwise left the player on it: the
  // check below only moves `ready` and `needsOnboarding`, so `anonymous`
  // matched nothing and the button read as dead.
  if (state === "anonymous" && routeName === "account-unavailable") {
    return "/(public)/welcome";
  }
  if (state !== "ready" && state !== "needsOnboarding") return null;
  if (routeName === "update-password") return null;

  const destination = authRouteForState(state);
  const destName =
    typeof destination === "string" ? destination.split("/").pop() : null;
  return destination && destName !== routeName ? destination : null;
}

/** Canonical post-auth destination for a resolved access state. */
export function authRouteForState(state: AccessState): Href | null {
  if (
    isPasswordRecoveryPending() &&
    (state === "ready" || state === "needsOnboarding")
  ) {
    return "/(auth)/update-password";
  }
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
