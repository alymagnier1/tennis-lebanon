import { describe, expect, it } from "vitest";
import { joinOnboardingAreaNames } from "./onboarding-commitment";

describe("joinOnboardingAreaNames", () => {
  it("joins a few area names for the commitment echo", () => {
    expect(joinOnboardingAreaNames(["Pilot Central", "Beirut"])).toBe(
      "Pilot Central · Beirut",
    );
  });

  it("returns empty when nothing is selected", () => {
    expect(joinOnboardingAreaNames([])).toBe("");
    expect(joinOnboardingAreaNames(["  "])).toBe("");
  });
});
