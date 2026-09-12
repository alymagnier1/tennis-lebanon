import { describe, expect, it } from "vitest";
import {
  POLICY_VERSIONS,
  isAdultBirthYear,
  normalizeDisplayName,
  newPasswordSchema,
  onboardingInputSchema,
  passwordResetSchema,
  signInSchema,
  signUpSchema,
} from "./onboarding";

const validInput = {
  displayName: "Player One",
  birthYear: 1990,
  isAdultConfirmed: true as const,
  languages: ["en"] as const,
  skillBand: "intermediate" as const,
  playIntent: "either" as const,
  prefersSingles: true,
  prefersDoubles: false,
  zoneIds: ["aaaaaaaa-0001-0001-0001-000000000001"],
  termsVersion: POLICY_VERSIONS.terms,
  privacyVersion: POLICY_VERSIONS.privacy,
  communityRulesVersion: POLICY_VERSIONS.communityRules,
};

describe("onboarding domain rules", () => {
  it("normalizes display names", () => {
    expect(normalizeDisplayName("  Player   One ")).toBe("Player One");
  });

  it("uses a conservative birth-year adult gate", () => {
    expect(isAdultBirthYear(2000, 2026)).toBe(true);
    expect(isAdultBirthYear(2009, 2026)).toBe(false);
  });

  it("accepts either preferred format flags for legacy rows", () => {
    const result = onboardingInputSchema.safeParse({
      ...validInput,
      prefersSingles: false,
      prefersDoubles: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects stale policy versions", () => {
    const result = onboardingInputSchema.safeParse({
      ...validInput,
      termsVersion: "old",
    });
    expect(result.success).toBe(false);
  });

  it("deduplicates languages and zones", () => {
    const result = onboardingInputSchema.parse({
      ...validInput,
      languages: ["en", "en"],
      zoneIds: [validInput.zoneIds[0], validInput.zoneIds[0]],
    });
    expect(result.languages).toEqual(["en"]);
    expect(result.zoneIds).toHaveLength(1);
  });
});

describe("password auth schemas", () => {
  it("accepts a normalised email and an 8-character password", () => {
    expect(
      signInSchema.parse({
        email: "  Player@Example.com ",
        password: "secret12",
      }),
    ).toEqual({ email: "player@example.com", password: "secret12" });
    expect(signUpSchema).toBe(signInSchema);
  });

  it("rejects a short password and a bad email", () => {
    expect(
      signInSchema.safeParse({ email: "player@example.com", password: "short" })
        .success,
    ).toBe(false);
    expect(
      passwordResetSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
    expect(
      newPasswordSchema.safeParse({ password: "longenough" }).success,
    ).toBe(true);
  });
});
