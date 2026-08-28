import type { OpenMatchCard } from "@tennis-lebanon/api";
import { clubIdsFromList } from "./match-clubs";

export const HOME_OPEN_MATCHES_LIMIT = 2;
export const HOME_OPEN_MATCHES_FETCH_LIMIT = 20;

export function matchOverlapsHomePreferences(
  match: OpenMatchCard,
  favoriteClubIds: readonly string[],
): boolean {
  if (match.availability_overlap || match.zone_overlap) return true;
  if (favoriteClubIds.length === 0) return false;
  const favorites = new Set(favoriteClubIds);
  return clubIdsFromList(match.preferred_clubs).some((id) => favorites.has(id));
}

function overlapScore(
  match: OpenMatchCard,
  favoriteClubIds: ReadonlySet<string>,
): number {
  const clubOverlap = clubIdsFromList(match.preferred_clubs).some((id) =>
    favoriteClubIds.has(id),
  );
  return (
    (match.availability_overlap ? 4 : 0) +
    (clubOverlap ? 2 : 0) +
    (match.zone_overlap ? 1 : 0)
  );
}

/** At most two public open matches that share the viewer's time, club, or area. */
export function pickHomeOpenMatches(
  matches: OpenMatchCard[],
  favoriteClubIds: readonly string[],
  limit = HOME_OPEN_MATCHES_LIMIT,
): OpenMatchCard[] {
  const favorites = new Set(favoriteClubIds);
  return matches
    .filter((match) => matchOverlapsHomePreferences(match, favoriteClubIds))
    .sort((left, right) => {
      const byScore =
        overlapScore(right, favorites) - overlapScore(left, favorites);
      if (byScore !== 0) return byScore;
      if (left.created_at !== right.created_at) {
        return left.created_at < right.created_at ? 1 : -1;
      }
      return left.match_id.localeCompare(right.match_id);
    })
    .slice(0, limit);
}
