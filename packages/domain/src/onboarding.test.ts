import { describe, expect, it } from "vitest";
import {
  POLICY_VERSIONS,
  isAdultBirthYear,
  normalizeDisplayName,
  onboardingInputSchema,
  scoreSkillQuestionnaire,
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

  it("requires at least one preferred format", () => {
    const result = onboardingInputSchema.safeParse({
      ...validInput,
      prefersSingles: false,
    });
    expect(result.success).toBe(false);
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

  it("maps questionnaire scores to provisional bands", () => {
    expect(
      scoreSkillQuestionnaire({
        experience: 0,
        frequency: 0,
        rally: 0,
        matchExperience: 0,
      }),
    ).toBe("beginner");
    expect(
      scoreSkillQuestionnaire({
        experience: 4,
        frequency: 4,
        rally: 4,
        matchExperience: 4,
      }),
    ).toBe("competitive");
  });
});
