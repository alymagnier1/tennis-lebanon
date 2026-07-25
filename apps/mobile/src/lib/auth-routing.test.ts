import { describe, expect, it } from "vitest";
import { authRouteForState } from "./auth-routing";

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
