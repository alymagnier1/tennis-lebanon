import type { TFunction } from "i18next";

export function formatMatchesPlayedLabel(count: number, t: TFunction): string {
  return count === 1
    ? t("discover.matchesPlayed_one")
    : t("discover.matchesPlayed_other", { count });
}
