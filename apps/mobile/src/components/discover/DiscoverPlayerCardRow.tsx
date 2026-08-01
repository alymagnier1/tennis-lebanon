import { Alert, Share } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createMatchInvite,
  type CompatiblePlayerCard,
  type MyMatchRow,
} from "@tennis-lebanon/api";
import { DiscoverPlayerCard } from "./DiscoverPlayerCard";
import { buildMatchInviteUrl } from "../../lib/invite-link";
import { playerFormatLabel } from "../../lib/player-format-label";
import { formatMatchesPlayedLabel } from "../../lib/matches-played-label";
import { publicPlayerLevelChip } from "../../lib/player-level-label";
import {
  availabilityDayPartsFromOverlap,
  type AvailabilityDayPart,
} from "../../lib/player-availability-label";
import { CREATE_MATCH_ROUTE } from "../../lib/routes";
import { supabase } from "../../lib/supabase";
import { zoneLabelFromList } from "../../lib/zones";

function availabilityTag(
  player: CompatiblePlayerCard,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!player.overlap_starts_at || !player.overlap_ends_at) {
    return null;
  }

  const parts = availabilityDayPartsFromOverlap(
    player.overlap_starts_at,
    player.overlap_ends_at,
  );
  return formatAvailabilityDayParts(parts, t);
}

function formatAvailabilityDayParts(
  parts: AvailabilityDayPart[],
  t: (key: string) => string,
): string {
  const labels = [...new Set(parts)].map((part) =>
    t(`availability.blocks.${part}`),
  );

  if (labels.length === 1) {
    return labels[0]!;
  }

  return labels.join(" & ");
}

export function DiscoverPlayerCardRow({
  player,
  inviteableMatches,
  locale,
}: {
  player: CompatiblePlayerCard;
  inviteableMatches: MyMatchRow[];
  locale: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: (matchId: string) =>
      createMatchInvite(supabase, matchId, player.user_id),
    onSuccess: async (token) => {
      await queryClient.invalidateQueries({ queryKey: ["my-match-invites"] });
      Alert.alert(t("matches.invite.sent"));
      await Share.share({
        message: t("matches.invite.shareMessage", {
          url: buildMatchInviteUrl(token),
        }),
      });
    },
    onError: () => Alert.alert(t("matches.invite.error")),
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
      router.push({
        pathname: "/player/[id]",
        params: { id: player.user_id },
      });
      return;
    }
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
      formatTag={playerFormatLabel(player, t)}
      intentTag={t(`playIntent.${player.play_intent}`)}
      availabilityTag={availabilityTag(player, t)}
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
