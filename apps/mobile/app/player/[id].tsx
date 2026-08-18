import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
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
import {
  buildMatchInviteUrl,
  matchInviteErrorKey,
  shareMatchInvite,
} from "../../src/lib/invite-link";
import { supabase } from "../../src/lib/supabase";
import { useToast } from "../../src/providers/ToastProvider";
import { beginCreateMatchForPlayer } from "../../src/lib/begin-create-match-for-player";
import { CREATE_MATCH_ROUTE } from "../../src/lib/routes";
import { zoneLabelFromList } from "../../src/lib/zones";
import { PlayerAvailabilitySection } from "../../src/components/player/PlayerAvailabilitySection";
import { PlayerPreferredClubsSection } from "../../src/components/player/PlayerPreferredClubsSection";
import { PlayerProfileHero } from "../../src/components/player/PlayerProfileHero";
import { PlayerProfileSection } from "../../src/components/player/PlayerProfileSection";
import { PlayerProfileSafetySection } from "../../src/components/player/PlayerProfileSafetySection";
import { PlayerRecentMatchesSection } from "../../src/components/player/PlayerRecentMatchesSection";
import {
  FigmaPrimaryButton,
  FigmaSecondaryButton,
} from "../../src/components/onboarding-ui";
import {
  tennisColors,
  tennisRadii,
  tennisSpacing,
} from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { exitPlayerProfile } from "../../src/lib/navigation";

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
  const { showToast } = useToast();
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
      exitPlayerProfile();
    },
    onError: () => {
      Alert.alert(t("discover.blockError"));
    },
  });

  // Toast rather than `Alert`, which react-native-web ignores: this is where a
  // host with several open matches lands from a Discover card, so a silent
  // result here reads as the invite never happening.
  const inviteMutation = useMutation({
    mutationFn: (matchId: string) => {
      setInvitingMatchId(matchId);
      return createMatchInvite(supabase, matchId, id!);
    },
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
          onPress={exitPlayerProfile}
        />
      </View>
    );
  }

  const name = player.display_name;
  const locationLabel = zoneLabelFromList(player.zones, locale);
  const aboutBio = player.bio?.trim() ?? "";
  const hasAboutContent = aboutBio.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 112 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PlayerProfileHero
          player={player}
          name={name}
          locationLabel={locationLabel}
          onBack={exitPlayerProfile}
        />

        <View style={styles.body}>
          {hasAboutContent ? (
            <PlayerProfileSection title={t("playerProfile.aboutTitle")}>
              <AppText style={[styles.bio, { writingDirection }]}>
                {aboutBio}
              </AppText>
            </PlayerProfileSection>
          ) : null}

          <PlayerAvailabilitySection
            player={player}
            summary={availabilityQuery.data}
          />

          <PlayerPreferredClubsSection player={player} />

          {inviteableMatches.length > 0 ? (
            <PlayerProfileSection title={t("matches.invite.pickMatch")}>
              <AppText style={[styles.inviteHint, { writingDirection }]}>
                {t("matches.invite.pickMatchHint")}
              </AppText>
              {inviteableMatches.map((match) => (
                <View key={match.match_id} style={styles.inviteCard}>
                  <View style={styles.inviteCopy}>
                    <AppText
                      style={[styles.inviteTitle, { writingDirection }]}
                      maxLines={2}
                    >
                      {t(`formats.${match.format}`)} ·{" "}
                      {t(`matches.status.${match.status}`)}
                    </AppText>
                    <AppText style={[styles.inviteMeta, { writingDirection }]}>
                      {match.soonest_time
                        ? formatUtcInBeirut(match.soonest_time)
                        : t("matches.invite.noTimeYet")}
                    </AppText>
                  </View>
                  <FigmaSecondaryButton
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

          <PlayerRecentMatchesSection matches={recentMatchesQuery.data ?? []} />

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
          {
            paddingBottom: insets.bottom + 12,
            paddingHorizontal: tennisSpacing.screenX,
          },
        ]}
      >
        <FigmaPrimaryButton
          label={t("playerProfile.challengeCta")}
          onPress={() => {
            if (!playerQuery.data) return;
            beginCreateMatchForPlayer(playerQuery.data);
            router.push(CREATE_MATCH_ROUTE);
          }}
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
    paddingHorizontal: tennisSpacing.screenX,
    paddingTop: 16,
    gap: 12,
  },
  bio: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    color: tennisColors.primaryDark,
  },
  inviteHint: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: tennisColors.mutedForeground,
    marginBottom: 2,
  },
  inviteCard: {
    gap: 10,
    padding: 12,
    borderRadius: tennisRadii.md,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
  },
  inviteCopy: {
    gap: 4,
  },
  inviteTitle: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 14,
    lineHeight: 18,
    color: tennisColors.primaryDark,
  },
  inviteMeta: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    lineHeight: 16,
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
