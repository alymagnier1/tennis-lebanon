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
