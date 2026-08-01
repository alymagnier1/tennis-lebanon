import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { formatPublicPlayerLevelLabel } from "@tennis-lebanon/domain";
import type { TFunction } from "i18next";

/**
 * Compact form for the level chip on a player card. The full label runs to
 * "Lower intermediate · Provisional" — 191px, which on a narrow phone leaves
 * almost no room for the name beside it. An established player shows their
 * number; everyone else shows the short band, since the absence of a number
 * already communicates provisional.
 */
export function publicPlayerLevelChip(
  player: Pick<CompatiblePlayerCard, "skill_band" | "display_rating">,
  t: TFunction,
): string {
  if (player.display_rating != null) {
    return String(player.display_rating);
  }
  return t(`skillBandsShort.${player.skill_band}`);
}

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
