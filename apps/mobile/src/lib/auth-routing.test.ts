import { afterEach, describe, expect, it } from "vitest";
import { authRouteForState, publicRouteRedirect } from "./auth-routing";
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
