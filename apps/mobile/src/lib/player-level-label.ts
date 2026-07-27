import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { formatPublicPlayerLevelLabel } from "@tennis-lebanon/domain";
import type { TFunction } from "i18next";

export function publicPlayerLevelLabel(
  player: Pick<
    CompatiblePlayerCard,
    "skill_band" | "display_rating" | "provisional_rating_label"
  >,
  t: TFunction,
): string {
  return formatPublicPlayerLevelLabel({
    skillBand: player.skill_band,
    displayRating: player.display_rating,
    provisionalRatingLabel: player.provisional_rating_label,
    translateSkillBand: (band) => t(`skillBands.${band}`),
    translateProvisional: () => t("rating.provisionalBadge"),
  });
}
