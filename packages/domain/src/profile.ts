import { z } from "zod";
import {
  databaseUuidSchema,
  normalizeDisplayName,
  skillBandSchema,
  supportedLanguageSchema,
} from "./onboarding";

export const updateOwnProfileSchema = z.object({
  displayName: z
    .string()
    .transform(normalizeDisplayName)
    .pipe(z.string().min(2).max(50)),
  languages: z.array(supportedLanguageSchema).min(1),
  bio: z.string().trim().max(300).optional(),
});

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

// Tennis preferences are edited through updateMatchHostDefaultsSchema, which
// covers the same fields plus the level range and listing defaults.

export const updatePreferredZonesSchema = z.object({
  zoneIds: z
    .array(databaseUuidSchema)
    .min(1)
    .max(10)
    .transform((values) => [...new Set(values)]),
});

export type UpdatePreferredZonesInput = z.infer<
  typeof updatePreferredZonesSchema
>;

export const setOwnSkillBandSchema = z.object({
  skillBand: skillBandSchema,
});

export type SetOwnSkillBandInput = z.infer<typeof setOwnSkillBandSchema>;

/**
 * Self-declared and optional. `null` is the answer "prefer not to say" rather
 * than a missing value, which is why there is no sentinel member for it: an
 * absent gender and a declined one are the same thing to everything
 * downstream, and nothing filters on either.
 */
export const genderSchema = z.enum(["woman", "man", "other"]);

export type Gender = z.infer<typeof genderSchema>;

export const setOwnGenderSchema = z.object({
  gender: genderSchema.nullable(),
});

export type SetOwnGenderInput = z.infer<typeof setOwnGenderSchema>;
