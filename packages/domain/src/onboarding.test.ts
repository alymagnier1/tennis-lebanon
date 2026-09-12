import { describe, expect, it } from "vitest";
import {
  POLICY_VERSIONS,
  isAdultBirthYear,
  normalizeDisplayName,
  newPasswordSchema,
  onboardingInputSchema,
  passwordByteLength,
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

describe("password byte limit", () => {
  // Built from code points so this file stays pure ASCII.
  const arabicKaf = String.fromCodePoint(0x0643);
  const tennisBall = String.fromCodePoint(0x1f3be);

  it("counts UTF-8 bytes, not characters", () => {
    expect(passwordByteLength("secret12")).toBe(8);
    expect(passwordByteLength(arabicKaf)).toBe(2);
    // One code point above the BMP: four bytes, counted once not twice.
    expect(passwordByteLength(tennisBall)).toBe(4);
    expect(tennisBall.length).toBe(2);
  });

  /**
   * bcrypt truncates at 72 bytes. 40 Arabic characters are 80 bytes, so a
   * character-counted limit would accept a password whose tail protects
   * nothing.
   */
  it("rejects a password short in characters but long in bytes", () => {
    const arabic = arabicKaf.repeat(40);
    expect(arabic.length).toBeLessThan(72);
    expect(passwordByteLength(arabic)).toBeGreaterThan(72);
    expect(newPasswordSchema.safeParse({ password: arabic }).success).toBe(
      false,
    );
  });

  it("accepts exactly 72 bytes and rejects 73", () => {
    const ascii = "a".repeat(72);
    expect(newPasswordSchema.safeParse({ password: ascii }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: ascii + "a" }).success).toBe(
      false,
    );
  });
});
