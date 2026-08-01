import type { OwnPlayerProfile } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";
import { zoneLabelFromList } from "./zones";

export function buildOwnPlayStyleTags(
  player: OwnPlayerProfile,
  zones: unknown,
  locale: string,
  t: TFunction,
): string[] {
  const tags: string[] = [t(`playIntent.${player.play_intent}`)];

  if (player.prefers_singles && player.prefers_doubles) {
    tags.push(t("formats.both"));
  } else if (player.prefers_singles) {
    tags.push(t("formats.singles"));
  } else if (player.prefers_doubles) {
    tags.push(t("formats.doubles"));
  }

  const zoneLabel = zoneLabelFromList(zones, locale);
  if (zoneLabel) {
    tags.push(zoneLabel);
  }

  return tags;
}
