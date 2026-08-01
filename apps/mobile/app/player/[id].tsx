import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  blockUser,
  createMatchInvite,
  getPublicPlayerAvailabilitySummary,
  getPublicPlayerCard,
  listMyMatches,
  listPublicPlayerRecentMatches,
  type MyMatchRow,
} from "@tennis-lebanon/api";
import { isInviteableHostedMatch } from "@tennis-lebanon/domain";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../src/components/AppText";
import { formatUtcInBeirut } from "../../src/lib/beirut-time";
import { buildMatchInviteUrl } from "../../src/lib/invite-link";
import { supabase } from "../../src/lib/supabase";
import { CREATE_MATCH_ROUTE } from "../../src/lib/routes";
import { zoneLabelFromList } from "../../src/lib/zones";
import { PlayerAvailabilitySection } from "../../src/components/player/PlayerAvailabilitySection";
import { PlayerProfileHero } from "../../src/components/player/PlayerProfileHero";
import { PlayerProfileSection } from "../../src/components/player/PlayerProfileSection";
import { PlayerProfileSafetySection } from "../../src/components/player/PlayerProfileSafetySection";
import { PlayerRecentMatchesSection } from "../../src/components/player/PlayerRecentMatchesSection";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../src/components/onboarding-ui";
import { tennisColors, tennisSpacing } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { useLayoutDirection } from "../../src/lib/layout-direction";

function sortBySoonestTime(a: MyMatchRow, b: MyMatchRow): number {
  if (!a.soonest_time && !b.soonest_time) return 0;
  if (!a.soonest_time) return 1;
  if (!b.soonest_time) return -1;
  return a.soonest_time.localeCompare(b.soonest_time);
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();
  const [invitingMatchId, setInvitingMatchId] = useState<string | null>(null);

  const playerQuery = useQuery({
    queryKey: ["player-detail", id],
    queryFn: () => getPublicPlayerCard(supabase, id!),
    enabled: Boolean(id),
  });

  const availabilityQuery = useQuery({
    queryKey: ["player-availability-summary", id],
    queryFn: () => getPublicPlayerAvailabilitySummary(supabase, id!),
    enabled: Boolean(id),
  });

  const recentMatchesQuery = useQuery({
    queryKey: ["player-recent-matches", id],
    queryFn: () => listPublicPlayerRecentMatches(supabase, id!, 5),
    enabled: Boolean(id),
  });

  const inviteableMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });

  const inviteableMatches = useMemo(
    () =>
      (inviteableMatchesQuery.data ?? [])
        .filter(isInviteableHostedMatch)
        .sort(sortBySoonestTime),
    [inviteableMatchesQuery.data],
  );

  const blockMutation = useMutation({
    mutationFn: () => blockUser(supabase, id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
      await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });
      Alert.alert(t("discover.blockSuccess"));
      router.back();
    },
    onError: () => {
      Alert.alert(t("discover.blockError"));
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (matchId: string) => {
      setInvitingMatchId(matchId);
      return createMatchInvite(supabase, matchId, id!);
    },
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
    onSettled: () => setInvitingMatchId(null),
  });

  const player = playerQuery.data;
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const isLoading =
    playerQuery.isLoading ||
    availabilityQuery.isLoading ||
    recentMatchesQuery.isLoading;

  if (isLoading && !player) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={tennisColors.primary} />
      </View>
    );
  }

  if (playerQuery.isError || !player) {
    return (
      <View style={[styles.errorRoot, { paddingTop: insets.top + 24 }]}>
        <AppText style={styles.errorText}>
          {t("discover.playerLoadError")}
        </AppText>
        <FigmaSecondaryButton
          label={t("common.back")}
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const name = player.display_name;
  const locationLabel = zoneLabelFromList(player.zones, locale);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PlayerProfileHero
          player={player}
          name={name}
          locationLabel={locationLabel}
          onBack={() => router.back()}
        />

        <View style={styles.body}>
          {player.bio ? (
            <PlayerProfileSection title={t("playerProfile.aboutTitle")}>
              <AppText style={[styles.bio, { writingDirection }]}>
                {player.bio}
              </AppText>
            </PlayerProfileSection>
          ) : null}

          <PlayerAvailabilitySection
            player={player}
            summary={availabilityQuery.data}
          />

          <PlayerRecentMatchesSection matches={recentMatchesQuery.data ?? []} />

          {inviteableMatches.length > 0 ? (
            <PlayerProfileSection title={t("matches.invite.pickMatch")}>
              {inviteableMatches.map((match) => (
                <View key={match.match_id} style={styles.inviteCard}>
                  <AppText style={styles.inviteTitle}>
                    {t(`formats.${match.format}`)} ·{" "}
                    {t(`matches.status.${match.status}`)}
                  </AppText>
                  <AppText style={styles.inviteMeta}>
                    {match.soonest_time
                      ? formatUtcInBeirut(match.soonest_time)
                      : t("matches.invite.noTimeYet")}
                  </AppText>
                  <FigmaPrimaryButton
                    label={t("matches.invite.inviteToOpenMatch")}
                    loading={
                      inviteMutation.isPending &&
                      invitingMatchId === match.match_id
                    }
                    disabled={
                      inviteMutation.isPending &&
                      invitingMatchId !== null &&
                      invitingMatchId !== match.match_id
                    }
                    onPress={() => inviteMutation.mutate(match.match_id)}
                  />
                </View>
              ))}
            </PlayerProfileSection>
          ) : null}

          <PlayerProfileSafetySection
            playerId={id!}
            blockLoading={blockMutation.isPending}
            onBlock={() => blockMutation.mutate()}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 12, paddingHorizontal: 20 },
        ]}
      >
        <FigmaPrimaryButton
          label={t("playerProfile.challengeCta")}
          onPress={() => router.push(CREATE_MATCH_ROUTE)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tennisColors.background,
  },
  errorRoot: {
    flex: 1,
    backgroundColor: tennisColors.background,
    paddingHorizontal: tennisSpacing.screenX,
    gap: 16,
  },
  errorText: {
    fontFamily: tennisFontFamily.body,
    fontSize: 15,
    color: tennisColors.accent,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  bio: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    color: tennisColors.mutedForeground,
  },
  inviteCard: {
    gap: 8,
  },
  inviteTitle: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 13,
    color: tennisColors.primaryDark,
  },
  inviteMeta: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    backgroundColor: tennisColors.background,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
  },
});
