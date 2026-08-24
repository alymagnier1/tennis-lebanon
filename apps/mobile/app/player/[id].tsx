import { notify } from "../../src/lib/confirm-action";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  blockUser,
  getPublicPlayerAvailabilitySummary,
  getPublicPlayerCard,
  listMyMatches,
  listPublicPlayerRecentMatches,
} from "@tennis-lebanon/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../src/components/AppText";
import { supabase } from "../../src/lib/supabase";
import { openAskToPlayFlow } from "../../src/lib/create-match-guard";
import { PlayerAvailabilitySection } from "../../src/components/player/PlayerAvailabilitySection";
import { PlayerPreferredClubsSection } from "../../src/components/player/PlayerPreferredClubsSection";
import { PlayerProfileHero } from "../../src/components/player/PlayerProfileHero";
import { PlayerProfileSection } from "../../src/components/player/PlayerProfileSection";
import { PlayerProfileSafetySection } from "../../src/components/player/PlayerProfileSafetySection";
import { PlayerRecentMatchesSection } from "../../src/components/player/PlayerRecentMatchesSection";
import { FigmaSecondaryButton } from "../../src/components/onboarding-ui";
import { tennisColors, tennisSpacing } from "../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../src/hooks/useTennisFonts";
import { useLayoutDirection } from "../../src/lib/layout-direction";
import { exitPlayerProfile } from "../../src/lib/navigation";

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { writingDirection } = useLayoutDirection();

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

  // Same cache entry the tab bar already fills; "Play request" creates, and
  // creating has a limit, so the guard needs the count.
  const myMatchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });

  const recentMatchesQuery = useQuery({
    queryKey: ["player-recent-matches", id],
    queryFn: () => listPublicPlayerRecentMatches(supabase, id!, 5),
    enabled: Boolean(id),
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(supabase, id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["discover-players"] });
      await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });
      notify(t("discover.blockSuccess"));
      exitPlayerProfile();
    },
    onError: () => {
      notify(t("discover.blockError"));
    },
  });

  const player = playerQuery.data;

  const startCreate = () => {
    if (!player) return;
    openAskToPlayFlow(player, myMatchesQuery.data, t);
  };
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
  const aboutBio = player.bio?.trim() ?? "";
  const hasAboutContent = aboutBio.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PlayerProfileHero
          player={player}
          name={name}
          onBack={exitPlayerProfile}
          // One meaning, always: arrange a match with this person. Filling a
          // match you already host lives on that match's own invite screen,
          // which knows its level range and who it has already asked.
          onChallenge={startCreate}
        />

        <View style={styles.body}>
          <PlayerProfileSection title={t("playerProfile.aboutTitle")}>
            <AppText
              style={[
                styles.bio,
                !hasAboutContent && styles.bioEmpty,
                { writingDirection },
              ]}
            >
              {hasAboutContent ? aboutBio : t("playerProfile.emptyAbout")}
            </AppText>
          </PlayerProfileSection>

          <PlayerPreferredClubsSection player={player} />

          <PlayerAvailabilitySection
            player={player}
            summary={availabilityQuery.data}
          />

          <PlayerRecentMatchesSection matches={recentMatchesQuery.data ?? []} />

          <PlayerProfileSafetySection
            playerId={id!}
            blockLoading={blockMutation.isPending}
            onBlock={() => blockMutation.mutate()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
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
    bioEmpty: {
      color: tennisColors.mutedForeground,
    },
  }),
);
