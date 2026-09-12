import { describe, expect, it } from "vitest";
import { validateOnboardingIdentity } from "./onboarding-identity-validation";

const valid = {
  displayName: "Ali",
  birthYear: "1992",
  isAdultConfirmed: true,
  languages: ["en" as const],
  skillBand: "intermediate" as const,
  currentYear: 2026,
};

describe("validateOnboardingIdentity", () => {
  it("returns no fields when the draft is complete", () => {
    expect(validateOnboardingIdentity(valid)).toEqual([]);
  });

  it("lists missing required fields in screen order", () => {
    expect(
      validateOnboardingIdentity({
        displayName: "",
        birthYear: "",
        isAdultConfirmed: false,
        languages: [],
        skillBand: null,
        currentYear: 2026,
      }),
    ).toEqual(["displayName", "birthYear", "languages", "skillBand"]);
  });

  it("separates an eligible year from a missing adult confirmation", () => {
    expect(
      validateOnboardingIdentity({
        ...valid,
        isAdultConfirmed: false,
      }),
    ).toEqual(["adultConfirm"]);
  });
});
