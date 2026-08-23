import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  type CompatiblePlayerCard,
  type MyMatchRow,
} from "@tennis-lebanon/api";
import { DiscoverPlayerCard } from "./DiscoverPlayerCard";
import { formatMatchesPlayedLabel } from "../../lib/matches-played-label";
import { publicPlayerLevelChip } from "../../lib/player-level-label";
import { discoverPlayerAvailabilityTags } from "../../lib/discover-availability-tag";
import { beginCreateMatchForPlayer } from "../../lib/begin-create-match-for-player";
import { clubNamesFromList } from "../../lib/match-clubs";
import { CREATE_MATCH_ROUTE } from "../../lib/routes";
import { zoneLabelFromList } from "../../lib/zones";

export function DiscoverPlayerCardRow({
  player,
  inviteableMatches,
  locale,
  showOverlapAvailability,
}: {
  player: CompatiblePlayerCard;
  inviteableMatches: MyMatchRow[];
  locale: string;
  showOverlapAvailability: boolean;
}) {
  const { t } = useTranslation();

  const hasInviteableMatch = inviteableMatches.length > 0;
  const primaryLabel = hasInviteableMatch
    ? t("matches.invite.invitePlayer")
    : t("matches.create.cta");

  const handlePrimaryPress = () => {
    if (hasInviteableMatch) {
      // Always to the picker, never a blind invite. One match used to be sent
      // straight from here, which meant a match you had merely joined -- any
      // participant may invite, not just the host -- could gain a stranger
      // without the sender ever seeing whose match it was.
      router.push({
        pathname: "/player/[id]",
        params: { id: player.user_id, pickMatch: "1" },
      });
      return;
    }
    beginCreateMatchForPlayer(player);
    router.push(CREATE_MATCH_ROUTE);
  };

  const openProfile = () => {
    router.push({
      pathname: "/player/[id]",
      params: { id: player.user_id },
    });
  };

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
      primaryLabel={primaryLabel}
      onProfilePress={openProfile}
      onPrimaryPress={handlePrimaryPress}
    />
  );
}
