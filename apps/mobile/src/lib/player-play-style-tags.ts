import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";

export function buildPlayerPlayStyleTags(
  player: CompatiblePlayerCard,
  t: TFunction,
): string[] {
  const tags: string[] = [t(`skillBandsShort.${player.skill_band}`)];

  tags.push(t(`playIntent.${player.play_intent}`));

  const zones = Array.isArray(player.zones)
    ? (player.zones as { name_i18n?: Record<string, string> }[])
    : [];

  if (zones.length > 0) {
    const firstZone = zones[0]?.name_i18n?.en ?? zones[0]?.name_i18n?.ar;
    if (firstZone) {
      tags.push(
        zones.length > 1 ? `${firstZone} +${zones.length - 1}` : firstZone,
      );
    }
  }

  return tags;
}
