import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { listMyMatches, type CompatiblePlayerCard } from "@tennis-lebanon/api";
import { DiscoverPlayerCard } from "./DiscoverPlayerCard";
import { formatMatchesPlayedLabel } from "../../lib/matches-played-label";
import { publicPlayerLevelChip } from "../../lib/player-level-label";
import { discoverPlayerAvailabilityTags } from "../../lib/discover-availability-tag";
import { openAskToPlayFlow } from "../../lib/create-match-guard";
import { clubNamesFromList } from "../../lib/match-clubs";
import { supabase } from "../../lib/supabase";
import { zoneLabelFromList } from "../../lib/zones";

/**
 * Discover asks people to play. It does not fill matches.
 *
 * This card used to do both, and the seam between them was the whole problem:
 * with an inviteable match it invited, otherwise it created, and working out
 * which match to invite into needed the player's availability against each
 * match's time -- a judgment first pushed onto the host through a sheet, then
 * made for them by an auto-picker. Both were answers to a question this surface
 * should never ask. Filling a match you already host lives on that match's own
 * invite screen, which knows its format, its level range, and who has already
 * been invited.
 */
export function DiscoverPlayerCardRow({
  player,
  locale,
  showOverlapAvailability,
}: {
  player: CompatiblePlayerCard;
  locale: string;
  showOverlapAvailability: boolean;
}) {
  const { t } = useTranslation();

  // Shares the tab bar's cache entry, so this costs no extra request. Needed
  // because "Ask to play" always creates, and creating has a limit.
  const myMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });

  return (
    <DiscoverPlayerCard
      player={player}
      name={player.display_name}
      locationLabel={zoneLabelFromList(player.zones, locale)}
      levelBadgeLabel={publicPlayerLevelChip(player, t)}
      matchesPlayedLabel={formatMatchesPlayedLabel(
        player.completed_match_count,
        t,
      )}
      availabilityTags={discoverPlayerAvailabilityTags(
        player,
        showOverlapAvailability,
        t,
      )}
      clubsTag={
        clubNamesFromList(player.favorite_clubs).slice(0, 2).join(" · ") || null
      }
      profileAccessibilityLabel={t("discover.openPlayerProfile", {
        name: player.display_name,
      })}
      primaryLabel={t("matches.invite.askToPlay")}
      onProfilePress={() =>
        router.push({
          pathname: "/player/[id]",
          params: { id: player.user_id },
        })
      }
      onPrimaryPress={() => openAskToPlayFlow(player, myMatchesQuery.data, t)}
    />
  );
}
