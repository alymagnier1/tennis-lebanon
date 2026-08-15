import type { CompatiblePlayerCard, OpenMatchCard } from "@tennis-lebanon/api";
import { clubLabelFromList } from "./match-clubs";
import { zoneLabelFromList } from "./zones";

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/** Case-insensitive name filter for Discover players. */
export function filterDiscoverPlayersBySearch(
  players: CompatiblePlayerCard[],
  query: string,
): CompatiblePlayerCard[] {
  const needle = normalizeQuery(query);
  if (!needle) return players;
  return players.filter((player) =>
    player.display_name.toLocaleLowerCase().includes(needle),
  );
}

/**
 * Match cards search host name, preferred/booked club, and area labels.
 * Locale is only used for zone name_i18n resolution.
 */
export function filterDiscoverMatchesBySearch(
  matches: OpenMatchCard[],
  query: string,
  locale: string,
): OpenMatchCard[] {
  const needle = normalizeQuery(query);
  if (!needle) return matches;

  return matches.filter((match) => {
    const haystack = [
      match.creator_display_name,
      match.court_club_name ?? "",
      clubLabelFromList(match.preferred_clubs),
      zoneLabelFromList(match.zones, locale),
      match.notes ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(needle);
  });
}
