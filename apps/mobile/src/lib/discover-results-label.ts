import type { TFunction } from "i18next";

/**
 * The results count above the list.
 *
 * `nearbyOnly` decides whether it may claim proximity. Every call used to take the
 * "near you" wording unconditionally, so the header said "8 players found near you"
 * while listing players from areas the viewer does not play in — the unsuffixed
 * keys existed in all three locales and were never reached. Pass whether a zone
 * restriction is actually in effect, not whether the Area chip looks pressed.
 */
export function formatDiscoverResultsLabel(
  segment: "players" | "matches",
  count: number,
  t: TFunction,
  nearbyOnly: boolean,
): string {
  if (segment === "players") {
    if (!nearbyOnly) {
      return count === 1
        ? t("discover.resultsPlayers_one", { count })
        : t("discover.resultsPlayers_other", { count });
    }

    return count === 1
      ? t("discover.resultsPlayersNear_one")
      : t("discover.resultsPlayersNear_other", { count });
  }

  if (!nearbyOnly) {
    return count === 1
      ? t("discover.resultsMatches_one", { count })
      : t("discover.resultsMatches_other", { count });
  }

  return count === 1
    ? t("discover.resultsMatchesNear_one")
    : t("discover.resultsMatchesNear_other", { count });
}
