import { describe, expect, it } from "vitest";
import { authRouteForState, publicRouteRedirect } from "./auth-routing";

describe("publicRouteRedirect", () => {
  it("keeps sign-in reachable while onboarding is incomplete", () => {
    expect(publicRouteRedirect("needsOnboarding", "sign-in")).toBeNull();
    expect(publicRouteRedirect("needsOnboarding", "welcome")).toBe(
      "/(onboarding)/consent",
    );
  });

  it("still redirects completed sessions away from public routes", () => {
    expect(publicRouteRedirect("ready", "sign-in")).toBe("/(tabs)");
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
