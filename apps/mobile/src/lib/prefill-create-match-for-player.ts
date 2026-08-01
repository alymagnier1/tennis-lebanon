import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import type { ProposedTimeInput } from "@tennis-lebanon/domain";
import {
  DEFAULT_LEVEL_WINDOW,
  ORDERED_SKILL_BANDS,
  playIntentSchema,
  skillBandRank,
  skillBandSchema,
  skillRangeFromSelection,
  visibilityFromListOnDiscover,
  type PlayIntent,
  type SkillBand,
} from "@tennis-lebanon/domain";
import type { Draft } from "./create-match-draft";

type PlayerZone = {
  id?: string;
};

export function preferredFormatForPlayer(
  player: Pick<CompatiblePlayerCard, "prefers_singles" | "prefers_doubles">,
): "singles" | "doubles" {
  if (player.prefers_singles && !player.prefers_doubles) {
    return "singles";
  }
  if (player.prefers_doubles && !player.prefers_singles) {
    return "doubles";
  }
  return "singles";
}

export function skillBandsForPlayer(
  band: SkillBand,
  levelWindow = DEFAULT_LEVEL_WINDOW,
): SkillBand[] {
  const targetRank = skillBandRank(band);
  return ORDERED_SKILL_BANDS.filter((candidate) => {
    return Math.abs(skillBandRank(candidate) - targetRank) <= levelWindow;
  });
}

export function zoneIdsFromPlayerZones(zones: unknown): string[] {
  if (!Array.isArray(zones)) {
    return [];
  }

  return zones
    .map((zone) => (zone as PlayerZone).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function overlapProposedTimeForPlayer(
  player: Pick<
    CompatiblePlayerCard,
    "overlap_starts_at" | "overlap_ends_at" | "near_term_overlap_slots"
  >,
): ProposedTimeInput | undefined {
  if (player.overlap_starts_at && player.overlap_ends_at) {
    return {
      startsAt: player.overlap_starts_at,
      endsAt: player.overlap_ends_at,
    };
  }

  const slot = player.near_term_overlap_slots[0];
  if (!slot) {
    return undefined;
  }

  return {
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
  };
}

export function prefillCreateMatchDraftForPlayer(
  player: CompatiblePlayerCard,
): Draft {
  const parsedBand = skillBandSchema.safeParse(player.skill_band);
  const selectedSkillBands = parsedBand.success
    ? skillBandsForPlayer(parsedBand.data)
    : skillBandsForPlayer("intermediate");
  const { minSkill, maxSkill } = skillRangeFromSelection(selectedSkillBands);

  const parsedIntent = playIntentSchema.safeParse(player.play_intent);
  const intent: PlayIntent = parsedIntent.success
    ? parsedIntent.data
    : "either";

  const proposedTime = overlapProposedTimeForPlayer(player);

  return {
    format: preferredFormatForPlayer(player),
    intent,
    minSkill,
    maxSkill,
    selectedSkillBands,
    visibility: visibilityFromListOnDiscover(false),
    requiresCreatorApproval: false,
    zoneIds: zoneIdsFromPlayerZones(player.zones),
    proposedTimes: proposedTime ? [proposedTime] : undefined,
    timingMode: "fixed",
    targetPlayerId: player.user_id,
    targetPlayerName: player.display_name,
  };
}
