import { afterEach, describe, expect, it } from "vitest";
import {
  authGroupRedirect,
  authRouteForState,
  publicRouteRedirect,
} from "./auth-routing";
import {
  clearPasswordRecoveryPending,
  markPasswordRecoveryPending,
} from "./password-recovery";

describe("publicRouteRedirect", () => {
  afterEach(() => {
    clearPasswordRecoveryPending();
  });

  it("keeps auth forms reachable while onboarding is incomplete", () => {
    expect(publicRouteRedirect("needsOnboarding", "sign-in")).toBeNull();
    expect(publicRouteRedirect("needsOnboarding", "sign-up")).toBeNull();
    expect(
      publicRouteRedirect("needsOnboarding", "forgot-password"),
    ).toBeNull();
    expect(publicRouteRedirect("needsOnboarding", "welcome")).toBe(
      "/(onboarding)/consent",
    );
  });

  it("still redirects completed sessions away from public routes", () => {
    expect(publicRouteRedirect("ready", "sign-in")).toBe("/(tabs)");
  });

  it("sends a recovery session to set a new password", () => {
    markPasswordRecoveryPending();
    expect(publicRouteRedirect("ready", "sign-in")).toBe(
      "/(auth)/update-password",
    );
    expect(authRouteForState("needsOnboarding")).toBe(
      "/(auth)/update-password",
    );
  });
});

describe("authRouteForState", () => {
  it("maps resolved states to canonical routes", () => {
    expect(authRouteForState("anonymous")).toBe("/(public)/welcome");
    expect(authRouteForState("needsOnboarding")).toBe("/(onboarding)/consent");
    expect(authRouteForState("ready")).toBe("/(tabs)");
    expect(authRouteForState("suspended")).toBe("/(auth)/account-unavailable");
    expect(authRouteForState("deletionRequested")).toBe(
      "/(auth)/account-unavailable",
    );
  });

  it("returns null while session is restoring or errored", () => {
    expect(authRouteForState("loading")).toBeNull();
    expect(authRouteForState("error")).toBeNull();
  });
});

describe("authGroupRedirect", () => {
  // The bug this function was extracted for. Settings sends a Google-created
  // account here to set its first password, and the inlined version compared
  // the route against `authRouteForState("ready")` -- which is `/(tabs)` --
  // so the screen redirected home before it rendered.
  it("lets a signed-in player reach update-password from settings", () => {
    expect(authGroupRedirect("ready", "update-password")).toBeNull();
    expect(authGroupRedirect("needsOnboarding", "update-password")).toBeNull();
  });

  it("still sends a signed-in player off the rest of the stack", () => {
    expect(authGroupRedirect("ready", "verify-code")).toBe("/(tabs)");
    expect(authGroupRedirect("needsOnboarding", "verify-code")).toBe(
      "/(onboarding)/consent",
    );
  });

  it("does not move a signed-in player already on their destination", () => {
    expect(authGroupRedirect("ready", "(tabs)")).toBeNull();
  });

  // Signing out of account-unavailable used to leave the player on it, which
  // read as a dead button when the sign-out had actually worked.
  it("moves an anonymous player off account-unavailable", () => {
    expect(authGroupRedirect("anonymous", "account-unavailable")).toBe(
      "/(public)/welcome",
    );
  });

  // The rest of this stack is for signed-out people and must stay reachable.
  it("leaves anonymous players on the screens built for them", () => {
    expect(authGroupRedirect("anonymous", "verify-code")).toBeNull();
    expect(authGroupRedirect("anonymous", "callback")).toBeNull();
    expect(authGroupRedirect("anonymous", "update-password")).toBeNull();
  });

  it("does nothing while the session is still resolving", () => {
    expect(authGroupRedirect("loading", "verify-code")).toBeNull();
    expect(authGroupRedirect("error", "verify-code")).toBeNull();
  });
});
