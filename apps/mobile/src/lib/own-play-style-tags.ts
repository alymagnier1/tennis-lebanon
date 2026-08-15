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

  const zoneLabel = zoneLabelFromList(zones, locale);
  if (zoneLabel) {
    tags.push(zoneLabel);
  }

  return tags;
}
