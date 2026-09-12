import { isAdultBirthYear, normalizeDisplayName } from "@tennis-lebanon/domain";
import type { SkillBand, SupportedLanguage } from "@tennis-lebanon/domain";

export type OnboardingIdentityField =
  "displayName" | "birthYear" | "adultConfirm" | "languages" | "skillBand";

export type OnboardingIdentityValues = {
  displayName: string;
  birthYear: string;
  isAdultConfirmed: boolean;
  languages: SupportedLanguage[];
  skillBand: SkillBand | null;
  currentYear?: number;
};

/**
 * Client-side gate for the identity onboarding step. Returns missing/invalid
 * fields in display order so the screen can highlight them and scroll to the
 * first one — errors used to sit above a sticky Continue and looked like a
 * no-op when the form was long.
 */
export function validateOnboardingIdentity(
  values: OnboardingIdentityValues,
): OnboardingIdentityField[] {
  const currentYear = values.currentYear ?? new Date().getUTCFullYear();
  const normalizedName = normalizeDisplayName(values.displayName);
  const numericYear = Number(values.birthYear);
  const hasYear =
    values.birthYear.length === 4 && Number.isInteger(numericYear);
  const missing: OnboardingIdentityField[] = [];

  if (normalizedName.length < 2 || normalizedName.length > 50) {
    missing.push("displayName");
  }

  if (!hasYear || !isAdultBirthYear(numericYear, currentYear)) {
    missing.push("birthYear");
  } else if (!values.isAdultConfirmed) {
    missing.push("adultConfirm");
  }

  if (values.languages.length === 0) {
    missing.push("languages");
  }

  if (!values.skillBand) {
    missing.push("skillBand");
  }

  return missing;
}
