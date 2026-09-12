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
/**
 * bcrypt hashes at most 72 **bytes** and silently drops the rest, so a limit
 * counted in characters lets a password be accepted while part of it protects
 * nothing. 50 Arabic characters are roughly 100 bytes, which makes this a real
 * case here rather than a theoretical one.
 *
 * Computed rather than using TextEncoder: this package is plain TypeScript
 * shared with the database layer and should not reach for a platform API.
 */
export const PASSWORD_MAX_BYTES = 72;

export function passwordByteLength(value: string): number {
  let bytes = 0;
  // Iterating a string yields whole code points, so surrogate pairs count once.
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/**
 * Supabase default is 6; 8 is the floor we show in the form. The character cap
 * is a cheap bound before the byte walk -- a string can never have fewer bytes
 * than characters, so anything longer than 72 characters is already too long.
 */
export const passwordSchema = z
  .string()
  .min(8)
  .max(PASSWORD_MAX_BYTES)
  .refine((value) => passwordByteLength(value) <= PASSWORD_MAX_BYTES, {
    message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`,
  });
export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export const signUpSchema = signInSchema;
export const passwordResetSchema = z.object({ email: emailSchema });
export const newPasswordSchema = z.object({ password: passwordSchema });
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
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
  });

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
