import type { TFunction } from "i18next";

export function formatDiscoverResultsLabel(
  segment: "players" | "matches",
  count: number,
  t: TFunction,
): string {
  if (segment === "players") {
    return count === 1
      ? t("discover.resultsPlayersNear_one")
      : t("discover.resultsPlayersNear_other", { count });
  }

  return count === 1
    ? t("discover.resultsMatchesNear_one")
    : t("discover.resultsMatchesNear_other", { count });
}
