import { useMemo, useState } from "react";
import { notify } from "../../src/lib/confirm-action";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../src/theme/create-live-sheet";
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
import { BottomSheet, SheetOption } from "../../src/components/AppUi";
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
import { playerProfileInviteAction } from "../../src/lib/player-profile-invite-action";
import { PlayerAvailabilitySection } from "../../src/components/player/PlayerAvailabilitySection";
import { PlayerPreferredClubsSection } from "../../src/components/player/PlayerPreferredClubsSection";
import { PlayerProfileHero } from "../../src/components/player/PlayerProfileHero";
import { PlayerProfileSection } from "../../src/components/player/PlayerProfileSection";
import { PlayerProfileSafetySection } from "../../src/components/player/PlayerProfileSafetySection";
import { PlayerRecentMatchesSection } from "../../src/components/player/PlayerRecentMatchesSection";
import { FigmaSecondaryButton } from "../../src/components/onboarding-ui";
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
  const { id, pickMatch } = useLocalSearchParams<{
    id: string;
    pickMatch?: string;
  }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { writingDirection } = useLayoutDirection();
  const [invitingMatchId, setInvitingMatchId] = useState<string | null>(null);

  // Derived from the param rather than synced into state by an effect: arriving
  // from a Discover card with several open matches should land straight on the
  // choice, and `dismissedPick` records only that the sheet was closed. The
  // effect-sync spelling of this has had to be rewritten twice in this codebase
  // for the compiler's cascading-render rule.
  const [pickOpen, setPickOpen] = useState(false);
  const [dismissedPick, setDismissedPick] = useState(false);
  const sheetOpen = pickOpen || (pickMatch === "1" && !dismissedPick);

  const closePick = () => {
    setPickOpen(false);
    setDismissedPick(true);
  };

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
      notify(t("discover.blockSuccess"));
      exitPlayerProfile();
    },
    onError: () => {
      notify(t("discover.blockError"));
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

  const startCreate = () => {
    closePick();
    if (!player) return;
    beginCreateMatchForPlayer(player);
    router.push(CREATE_MATCH_ROUTE);
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
          // Creating is only right when there is nothing to offer. With a
          // match already open, this used to walk the host into a dialog about
          // that very match, which was listed further down this same screen.
          onChallenge={() => {
            if (playerProfileInviteAction(inviteableMatches) === "create") {
              startCreate();
              return;
            }
            setPickOpen(true);
          }}
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

      <BottomSheet
        visible={sheetOpen}
        title={t("matches.invite.pickMatch")}
        onClose={closePick}
        footer={
          <FigmaSecondaryButton
            label={t("matches.invite.createInstead")}
            onPress={startCreate}
          />
        }
      >
        <AppText style={[styles.inviteHint, { writingDirection }]}>
          {t("matches.invite.pickMatchHint")}
        </AppText>
        {inviteableMatches.map((match) => (
          <SheetOption
            key={match.match_id}
            label={`${t(`formats.${match.format}`)} · ${t(`matches.status.${match.status}`)}`}
            description={
              match.soonest_time
                ? formatUtcInBeirut(match.soonest_time)
                : t("matches.invite.noTimeYet")
            }
            // Nothing is pre-chosen: picking one sends the invite, so a
            // selected-looking row would be a row somebody had been invited to.
            selected={invitingMatchId === match.match_id}
            onPress={() => {
              closePick();
              inviteMutation.mutate(match.match_id);
            }}
          />
        ))}
      </BottomSheet>
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
    inviteHint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
      marginBottom: 2,
    },
  }),
);
