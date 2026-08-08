import { z } from "zod";
import {
  DEFAULT_LEVEL_WINDOW,
  matchFormatSchema,
  skillBandRank,
} from "./discovery";
import {
  playIntentSchema,
  skillBandSchema,
  type PlayIntent,
  type SkillBand,
} from "./onboarding";
import {
  matchVisibilitySchema,
  visibilityFromListOnDiscover,
  type MatchVisibility,
} from "./matches";
import {
  ORDERED_SKILL_BANDS,
  skillBandsInRange,
  skillRangeFromSelection,
} from "./skill-range";


export const matchHostDefaultsRowSchema = z.object({
  skill_band: skillBandSchema,
  play_intent: playIntentSchema,
  prefers_singles: z.boolean(),
  prefers_doubles: z.boolean(),
  default_match_visibility: matchVisibilitySchema,
  default_requires_creator_approval: z.boolean(),
  default_min_skill: skillBandSchema.nullable(),
  default_max_skill: skillBandSchema.nullable(),
  default_match_format: matchFormatSchema.nullable(),
  match_defaults_set_at: z.string().nullable(),
});

export type MatchHostDefaultsRow = z.infer<typeof matchHostDefaultsRowSchema>;

export const updateMatchHostDefaultsSchema = z
  .object({
    playIntent: playIntentSchema,
    prefersSingles: z.boolean(),
    prefersDoubles: z.boolean(),
    listOnDiscover: z.boolean(),
    defaultRequiresCreatorApproval: z.boolean(),
    defaultMinSkill: skillBandSchema,
    defaultMaxSkill: skillBandSchema,
    defaultMatchFormat: matchFormatSchema.optional(),
  })
  .superRefine((value, context) => {
    if (!value.prefersSingles && !value.prefersDoubles) {
      context.addIssue({
        code: "custom",
        path: ["prefersSingles"],
        message: "Choose at least one match format.",
      });
    }

    if (skillBandRank(value.defaultMinSkill) > skillBandRank(value.defaultMaxSkill)) {
      context.addIssue({
        code: "custom",
        path: ["defaultMinSkill"],
        message: "defaultMinSkill must be less than or equal to defaultMaxSkill",
      });
    }

    if (value.prefersSingles && value.prefersDoubles && !value.defaultMatchFormat) {
      context.addIssue({
        code: "custom",
        path: ["defaultMatchFormat"],
        message: "Choose a default format when both singles and doubles are enabled.",
      });
    }
  });

export type UpdateMatchHostDefaultsInput = z.infer<
  typeof updateMatchHostDefaultsSchema
>;

export type ResolvedMatchHostDefaults = {
  format: "singles" | "doubles";
  intent: PlayIntent;
  minSkill: SkillBand;
  maxSkill: SkillBand;
  selectedSkillBands: SkillBand[];
  visibility: MatchVisibility;
  requiresCreatorApproval: boolean;
  timingMode: "fixed";
  matchDefaultsConfigured: boolean;
};

export function skillBandsForPlayer(
  band: SkillBand,
  levelWindow = DEFAULT_LEVEL_WINDOW,
): SkillBand[] {
  const targetRank = skillBandRank(band);
  return ORDERED_SKILL_BANDS.filter((candidate) => {
    return Math.abs(skillBandRank(candidate) - targetRank) <= levelWindow;
  });
}

export function preferredFormatForPlayer(
  player: Pick<
    { prefers_singles: boolean; prefers_doubles: boolean },
    "prefers_singles" | "prefers_doubles"
  >,
  explicitFormat?: "singles" | "doubles" | null,
): "singles" | "doubles" {
  if (explicitFormat) {
    return explicitFormat;
  }
  if (player.prefers_singles && !player.prefers_doubles) {
    return "singles";
  }
  if (player.prefers_doubles && !player.prefers_singles) {
    return "doubles";
  }
  return "singles";
}

export function hasConfiguredMatchDefaults(
  matchDefaultsSetAt: string | null | undefined,
): boolean {
  return Boolean(matchDefaultsSetAt);
}

export function resolveMatchHostDefaults(
  row: MatchHostDefaultsRow,
): ResolvedMatchHostDefaults {
  const derivedBands = skillBandsForPlayer(row.skill_band);
  const selectedSkillBands =
    row.default_min_skill && row.default_max_skill
      ? skillBandsInRange(row.default_min_skill, row.default_max_skill)
      : derivedBands;
  const { minSkill, maxSkill } = skillRangeFromSelection(selectedSkillBands);

  const visibility = row.default_match_visibility;
  const requiresCreatorApproval =
    visibility === "public" ? row.default_requires_creator_approval : false;

  return {
    format: preferredFormatForPlayer(row, row.default_match_format),
    intent: row.play_intent,
    minSkill,
    maxSkill,
    selectedSkillBands,
    visibility,
    requiresCreatorApproval,
    timingMode: "fixed",
    matchDefaultsConfigured: hasConfiguredMatchDefaults(row.match_defaults_set_at),
  };
}

export type CreateMatchDraftFromDefaults = {
  format: "singles" | "doubles";
  intent: PlayIntent;
  minSkill: SkillBand;
  maxSkill: SkillBand;
  selectedSkillBands: SkillBand[];
  visibility: MatchVisibility;
  requiresCreatorApproval: boolean;
  timingMode: "fixed";
  zoneIds: string[];
};

export function buildCreateMatchDraftFromHostDefaults(
  resolved: ResolvedMatchHostDefaults,
  zoneIds: string[],
): CreateMatchDraftFromDefaults {
  return {
    format: resolved.format,
    intent: resolved.intent,
    minSkill: resolved.minSkill,
    maxSkill: resolved.maxSkill,
    selectedSkillBands: resolved.selectedSkillBands,
    visibility: resolved.visibility,
    requiresCreatorApproval: resolved.requiresCreatorApproval,
    timingMode: resolved.timingMode,
    zoneIds,
  };
}

export function matchHostDefaultsRowFromProfile(
  profile: {
    skill_band: string;
    play_intent: string;
    prefers_singles: boolean;
    prefers_doubles: boolean;
    default_match_visibility: string;
    default_requires_creator_approval: boolean;
    default_min_skill: string | null;
    default_max_skill: string | null;
    default_match_format: string | null;
    match_defaults_set_at: string | null;
  },
): MatchHostDefaultsRow {
  return matchHostDefaultsRowSchema.parse(profile);
}

export function updateInputToDbPatch(input: UpdateMatchHostDefaultsInput): {
  play_intent: PlayIntent;
  prefers_singles: boolean;
  prefers_doubles: boolean;
  default_match_visibility: MatchVisibility;
  default_requires_creator_approval: boolean;
  default_min_skill: SkillBand;
  default_max_skill: SkillBand;
  default_match_format: "singles" | "doubles" | null;
} {
  const visibility = visibilityFromListOnDiscover(input.listOnDiscover);
  return {
    play_intent: input.playIntent,
    prefers_singles: input.prefersSingles,
    prefers_doubles: input.prefersDoubles,
    default_match_visibility: visibility,
    default_requires_creator_approval:
      visibility === "public" ? input.defaultRequiresCreatorApproval : false,
    default_min_skill: input.defaultMinSkill,
    default_max_skill: input.defaultMaxSkill,
    default_match_format:
      input.prefersSingles && input.prefersDoubles
        ? (input.defaultMatchFormat ?? null)
        : null,
  };
}

