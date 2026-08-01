import type { MatchHubCard } from "@tennis-lebanon/api";
import {
  formatSkillBandSelection,
  listOnDiscoverFromVisibility,
  ORDERED_SKILL_BANDS,
  skillBandsInRange,
  type SkillBand,
} from "@tennis-lebanon/domain";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function matchHubLevelSummary(
  hub: Pick<MatchHubCard, "min_skill" | "max_skill">,
  t: Translate,
): string {
  const selected = skillBandsInRange(
    hub.min_skill as SkillBand,
    hub.max_skill as SkillBand,
  );

  if (selected.length === ORDERED_SKILL_BANDS.length) {
    return t("matches.create.allLevels");
  }

  return formatSkillBandSelection(selected, (band) =>
    t(`skillBandsShort.${band}`),
  );
}

export function matchHubJoinSummary(
  hub: Pick<MatchHubCard, "visibility" | "requires_creator_approval">,
  t: Translate,
): string {
  const listed = listOnDiscoverFromVisibility(hub.visibility);
  const parts = [
    listed
      ? t("matches.create.summaryDiscover")
      : t("matches.create.summaryInviteOnly"),
  ];

  if (hub.requires_creator_approval && listed) {
    parts.push(t("matches.create.summaryApproval"));
  }

  return parts.join(" · ");
}
