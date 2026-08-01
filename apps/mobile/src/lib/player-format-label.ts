import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import type { TFunction } from "i18next";

export function playerFormatLabel(
  player: Pick<CompatiblePlayerCard, "prefers_singles" | "prefers_doubles">,
  t: TFunction,
): string {
  if (player.prefers_singles && player.prefers_doubles) {
    return t("formats.both");
  }
  if (player.prefers_singles) {
    return t("formats.singles");
  }
  return t("formats.doubles");
}
