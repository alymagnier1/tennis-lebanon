import { useQuery } from "@tanstack/react-query";
import {
  discoverOpenMatches,
  listOwnFavoriteClubIds,
} from "@tennis-lebanon/api";
import {
  HOME_OPEN_MATCHES_FETCH_LIMIT,
  pickHomeOpenMatches,
} from "../lib/home-open-matches";
import { supabase } from "../lib/supabase";

export function useHomeOpenMatchPicks() {
  const clubsQuery = useQuery({
    queryKey: ["own-favorite-club-ids"],
    queryFn: () => listOwnFavoriteClubIds(supabase),
    staleTime: 60_000,
  });

  const matchesQuery = useQuery({
    queryKey: ["home-open-matches"],
    queryFn: () =>
      discoverOpenMatches(supabase, { limit: HOME_OPEN_MATCHES_FETCH_LIMIT }),
    staleTime: 60_000,
  });

  const matches = pickHomeOpenMatches(
    matchesQuery.data ?? [],
    clubsQuery.data ?? [],
  );

  return { clubsQuery, matchesQuery, matches };
}
