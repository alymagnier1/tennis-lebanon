import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createMatchInvite,
  type CompatiblePlayerCard,
  type MyMatchRow,
} from "@tennis-lebanon/api";
import { DiscoverPlayerCard } from "./DiscoverPlayerCard";
import {
  buildMatchInviteUrl,
  matchInviteErrorKey,
  shareMatchInvite,
} from "../../lib/invite-link";
import { formatMatchesPlayedLabel } from "../../lib/matches-played-label";
import { publicPlayerLevelChip } from "../../lib/player-level-label";
import { discoverPlayerAvailabilityTags } from "../../lib/discover-availability-tag";
import { beginCreateMatchForPlayer } from "../../lib/begin-create-match-for-player";
import { clubNamesFromList } from "../../lib/match-clubs";
import { CREATE_MATCH_ROUTE } from "../../lib/routes";
import { supabase } from "../../lib/supabase";
import { zoneLabelFromList } from "../../lib/zones";
import { useToast } from "../../providers/ToastProvider";

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
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Feedback goes through the toast, not `Alert`: `Alert.alert` is a no-op on
  // react-native-web, which left the card's only action looking dead there.
  const inviteMutation = useMutation({
    mutationFn: (matchId: string) =>
      createMatchInvite(supabase, matchId, player.user_id),
    onSuccess: async (token) => {
      await queryClient.invalidateQueries({ queryKey: ["my-match-invites"] });
      showToast(t("matches.invite.sent"));
      await shareMatchInvite(
        t("matches.invite.shareMessage", {
          url: buildMatchInviteUrl(token),
        }),
      );
    },
    onError: (error: unknown) => showToast(t(matchInviteErrorKey(error))),
  });

  const hasInviteableMatch = inviteableMatches.length > 0;
  const primaryLabel = hasInviteableMatch
    ? t("matches.invite.invitePlayer")
    : t("matches.create.cta");

  const handlePrimaryPress = () => {
    if (inviteableMatches.length === 1) {
      inviteMutation.mutate(inviteableMatches[0]!.match_id);
      return;
    }
    if (inviteableMatches.length > 1) {
      // Straight to the choice rather than to a profile the host then has to
      // press again: the reason this card routes away is that there is more
      // than one match to pick from.
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
      primaryLoading={inviteMutation.isPending}
      onProfilePress={openProfile}
      onPrimaryPress={handlePrimaryPress}
    />
  );
}
