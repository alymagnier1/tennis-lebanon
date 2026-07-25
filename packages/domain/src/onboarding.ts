import { z } from "zod";

export const POLICY_VERSIONS = {
  terms: "dev-2026-07-25",
  privacy: "dev-2026-07-25",
  communityRules: "dev-2026-07-25",
} as const;

export const supportedLanguageSchema = z.enum(["en", "ar", "fr"]);
export const skillBandSchema = z.enum([
  "beginner",
  "improving",
  "intermediate",
  "advanced",
  "competitive",
]);
export const playIntentSchema = z.enum(["social", "competitive", "either"]);
export const emailSchema = z.string().trim().toLowerCase().email();
export const signInSchema = z.object({ email: emailSchema });
export type SignInInput = z.infer<typeof signInSchema>;
export const databaseUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;
export type SkillBand = z.infer<typeof skillBandSchema>;
export type PlayIntent = z.infer<typeof playIntentSchema>;

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isAdultBirthYear(
  birthYear: number,
  currentYear = new Date().getUTCFullYear(),
): boolean {
  return Number.isInteger(birthYear) && birthYear <= currentYear - 18;
}

export const skillQuestionnaireSchema = z.object({
  experience: z.number().int().min(0).max(4),
  frequency: z.number().int().min(0).max(4),
  rally: z.number().int().min(0).max(4),
  matchExperience: z.number().int().min(0).max(4),
});

export type SkillQuestionnaire = z.infer<typeof skillQuestionnaireSchema>;

export function scoreSkillQuestionnaire(
  answers: SkillQuestionnaire,
): SkillBand {
  const parsed = skillQuestionnaireSchema.parse(answers);
  const score = Object.values(parsed).reduce((sum, value) => sum + value, 0);

  if (score <= 3) return "beginner";
  if (score <= 6) return "improving";
  if (score <= 9) return "intermediate";
  if (score <= 12) return "advanced";
  return "competitive";
}

const currentYear = new Date().getUTCFullYear();

export const onboardingInputSchema = z
  .object({
    displayName: z
      .string()
      .transform(normalizeDisplayName)
      .pipe(z.string().min(2).max(50)),
    birthYear: z.number().int().min(1900).max(currentYear),
    isAdultConfirmed: z.literal(true),
    languages: z
      .array(supportedLanguageSchema)
      .min(1)
      .transform((values) => [...new Set(values)]),
    skillBand: skillBandSchema,
    playIntent: playIntentSchema,
    prefersSingles: z.boolean(),
    prefersDoubles: z.boolean(),
    zoneIds: z
      .array(databaseUuidSchema)
      .min(1)
      .max(10)
      .transform((values) => [...new Set(values)]),
    termsVersion: z.literal(POLICY_VERSIONS.terms),
    privacyVersion: z.literal(POLICY_VERSIONS.privacy),
    communityRulesVersion: z.literal(POLICY_VERSIONS.communityRules),
  })
  .superRefine((value, context) => {
    if (!isAdultBirthYear(value.birthYear, currentYear)) {
      context.addIssue({
        code: "custom",
        path: ["birthYear"],
        message: "Adult eligibility is required.",
      });
    }

    if (!value.prefersSingles && !value.prefersDoubles) {
      context.addIssue({
        code: "custom",
        path: ["prefersSingles"],
        message: "Choose at least one match format.",
      });
    }
  });

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
