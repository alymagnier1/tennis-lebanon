import { queryOptions } from "@tanstack/react-query";
import {
  discoverCompatiblePlayers,
  listOwnPreferredZoneIds,
} from "@tennis-lebanon/api";
import {
  MAX_LEVEL_WINDOW,
  resolveDiscoverFiltersFromProfile,
} from "@tennis-lebanon/domain";
import { supabase } from "./supabase";

/** Enough to feel like a choice, few enough that the rest is worth a tap through. */
const CARD_LIMIT = 5;

export const ownPreferredZoneIdsQueryOptions = queryOptions({
  queryKey: ["own-preferred-zone-ids"],
  queryFn: () => listOwnPreferredZoneIds(supabase),
  staleTime: 60_000,
});

/**
 * The players behind one Home time tab. Shared so the tab row can fetch every
 * tab's players up front: switching tabs then shows cards at once instead of
 * collapsing the section while they load.
 */
export function homeFreePlayersQueryOptions(
  block: { startsAt: string; endsAt: string },
  ownZoneIds: string[] | undefined,
) {
  return queryOptions({
    queryKey: ["home-free-players", block.startsAt, block.endsAt, ownZoneIds],
    queryFn: () =>
      // Same eligibility as Discover with Level/Intent/Availability off and
      // Area matching the liquidity count (viewer's own zones). A hard-coded
      // `levelWindow: 4` used to look wider than Discover's Level chip, which
      // only sorts — but View-all still opened the Matches tab, so the same
      // person looked absent. Keep the window at MAX and open Players.
      discoverCompatiblePlayers(supabase, {
        ...resolveDiscoverFiltersFromProfile({
          toggles: {
            matchLevel: false,
            matchArea: Boolean(ownZoneIds?.length),
            matchAvailability: false,
          },
          playIntent: "either",
          ownZoneIds,
        }),
        levelWindow: MAX_LEVEL_WINDOW,
        limit: CARD_LIMIT,
        freeFrom: block.startsAt,
        freeTo: block.endsAt,
      }),
    staleTime: 60_000,
  });
}
