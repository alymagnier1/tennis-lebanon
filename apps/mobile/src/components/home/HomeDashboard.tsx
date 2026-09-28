import { useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOwnPlayerProfile,
  listMyCompletedMatches,
  listMyMatchInvites,
  listMyMatches,
  listOwnAvailability,
  listUserNotifications,
  countUnreadNotifications,
} from "@tennis-lebanon/api";
import {
  isProvisionalPlayerRating,
  ratedMatchesUntilRatingUnlock,
} from "@tennis-lebanon/domain";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { EmptyState, ListSkeleton, MatchCard, Avatar } from "../AppUi";
import { ScreenError } from "../FormUi";
import { CountBadge } from "../CountBadge";
import { HomeFreeSlots } from "./HomeFreeSlots";
import { HomeRatingCard } from "./HomeRatingCard";
import { HomeOpenMatches } from "./HomeOpenMatches";
import { HomeNextActionsCarousel } from "./HomeNextActionsCarousel";
import { FigmaPrimaryButton, FigmaSecondaryButton } from "../onboarding-ui";
import { Icon } from "../Icon";
import { formatCompactUtcInBeirut } from "../../lib/beirut-time";
import {
  buildMatchCardHeadline,
  resolveMatchCardOpponent,
} from "../../lib/match-card-headline";
import { matchCardAreaLabel, matchCardClubLabel } from "../../lib/match-clubs";
import { opponentAvatarColor } from "../../lib/match-card-status";
import {
  completedMatchNeedsScore,
  formatTabBadgeCount,
  matchListAction,
  matchListActionOpensInvite,
  matchListStartsAt,
} from "../../lib/match-list-card";
import {
  deriveHomeNextActions,
  sortUpcomingMatches,
  type HomeNextAction,
} from "../../lib/home-next-actions";
import { trackRematch } from "../../lib/analytics";
import { beginRematch } from "../../lib/rematch-draft";
import { resolveRematchTarget } from "../../lib/start-rematch";
import {
  CREATE_MATCH_ROUTE,
  MATCHES_ROUTE,
  discoverOpenMatchesRoute,
  matchHubRoute,
  matchInviteRoute,
} from "../../lib/routes";
import { startNewMatchCreate } from "../../lib/create-match-guard";
import { useLayoutDirection } from "../../lib/layout-direction";
import { PROFILE_TAB_ROUTE } from "../../lib/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";
import { notify } from "../../lib/confirm-action";
import { profileScreenRatingStatValue } from "../../lib/profile-screen-copy";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useHomeOpenMatchPicks } from "../../hooks/useHomeOpenMatchPicks";
import { useHomeLiquidityOffers } from "../../hooks/useHomeLiquidityOffers";
import { homeFirstPlayKind } from "../../lib/home-first-play";

export function HomeDashboard({ displayName }: { displayName: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { profile, session } = useAuth();
  const insets = useSafeAreaInsets();
  const { rowDirection, writingDirection } = useLayoutDirection();

  const invitesQuery = useQuery({
    queryKey: ["my-match-invites"],
    queryFn: () => listMyMatchInvites(supabase),
  });
  const matchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });
  const completedQuery = useQuery({
    queryKey: ["my-completed-matches"],
    queryFn: () => listMyCompletedMatches(supabase),
  });
  const profileQuery = useQuery({
    queryKey: ["own-player-profile"],
    queryFn: () => getOwnPlayerProfile(supabase),
  });
  const notificationsQuery = useQuery({
    queryKey: ["user-notifications"],
    queryFn: () => listUserNotifications(supabase, 20),
  });

  const bodyLoading =
    invitesQuery.isLoading ||
    matchesQuery.isLoading ||
    completedQuery.isLoading ||
    profileQuery.isLoading;

  const bodyError =
    invitesQuery.isError ||
    matchesQuery.isError ||
    completedQuery.isError ||
    profileQuery.isError;

  // Counted server side rather than filtered from the 20-row page above: that
  // page answers "unread among the newest 20", which stops matching the badge
  // the moment anything older is left unread.
  const unreadQuery = useQuery({
    queryKey: ["user-notifications-unread"],
    queryFn: () => countUnreadNotifications(supabase),
  });
  const unreadCount = unreadQuery.data ?? 0;

  const upcomingMatches = sortUpcomingMatches(matchesQuery.data ?? []);
  const openMatchPicks = useHomeOpenMatchPicks();
  const liquidityOffers = useHomeLiquidityOffers();
  const availabilityQuery = useQuery({
    queryKey: ["own-availability", session?.user.id],
    queryFn: () => listOwnAvailability(supabase),
    enabled: Boolean(session?.user.id),
    staleTime: 60_000,
  });
  const setupReady =
    (!availabilityQuery.isEnabled || !availabilityQuery.isPending) &&
    !openMatchPicks.clubsQuery.isPending &&
    !availabilityQuery.isError &&
    !openMatchPicks.clubsQuery.isError;
  const nextActions = deriveHomeNextActions(
    invitesQuery.data ?? [],
    matchesQuery.data ?? [],
    completedQuery.data ?? [],
    new Date().toISOString(),
    setupReady
      ? {
          hasAvailability: (availabilityQuery.data?.length ?? 0) > 0,
          hasFavoriteClubs: (openMatchPicks.clubsQuery.data?.length ?? 0) > 0,
        }
      : undefined,
  );
  const firstPlayKind = homeFirstPlayKind({
    hasHeroAction: nextActions.length > 0,
    upcomingCount: upcomingMatches.length,
    openMatchCount: openMatchPicks.matches.length,
    // The same days Home's tabs show, so "free slots exist" and the tabs agree.
    freeSlotCount: liquidityOffers.days.length,
    openMatchesReady:
      !openMatchPicks.matchesQuery.isPending &&
      !openMatchPicks.clubsQuery.isPending,
    freeSlotsReady: !liquidityOffers.query.isPending,
    availabilityReady:
      !availabilityQuery.isEnabled || !availabilityQuery.isPending,
    openMatchesFailed:
      openMatchPicks.matchesQuery.isError || openMatchPicks.clubsQuery.isError,
    freeSlotsFailed: liquidityOffers.query.isError,
    availabilityFailed: availabilityQuery.isError,
  });
  const showFirstPlay = firstPlayKind !== null;
  const playerProfile = profileQuery.data;
  const matchesPlayed = completedQuery.data?.length ?? 0;

  // Rated matches, not completed ones: an unverified or disputed result never
  // moved the rating, so counting it here would promise a number that is not
  // actually coming.
  const ratedMatchCount = playerProfile?.rated_match_count ?? 0;
  const showRatingProgress = Boolean(
    playerProfile && isProvisionalPlayerRating(ratedMatchCount),
  );
  const ratingRemaining = ratedMatchesUntilRatingUnlock(ratedMatchCount);
  const ratingStatValue = playerProfile
    ? profileScreenRatingStatValue(
        playerProfile.rated_match_count,
        playerProfile.internal_rating,
      )
    : profileScreenRatingStatValue(0, 0);

  /**
   * "7 played / 0 of 5 rated" is honest but reads as a broken counter without the
   * reason. A match only counts towards a rating once a score is confirmed, so
   * say that, and say how many of theirs are still waiting on one.
   */
  const awaitingScore = (completedQuery.data ?? []).filter(
    completedMatchNeedsScore,
  ).length;

  /**
   * Home holds a CompletedMatchRow, which has no opponent ids and none of the
   * match shape a draft needs, so the hub is fetched on tap. Doubles is handed to
   * the hub instead of guessing which of three opponents "again" means.
   */
  const [rematchPending, setRematchPending] = useState(false);
  const startRematch = async (action: HomeNextAction) => {
    const viewerUserId = session?.user.id;
    if (!viewerUserId || rematchPending || !action.matchId) {
      return;
    }

    setRematchPending(true);
    try {
      const { outcome, hub } = await resolveRematchTarget({
        client: supabase,
        matchId: action.matchId,
        viewerUserId,
      });

      if (outcome.kind !== "ready") {
        router.push(matchHubRoute(action.matchId));
        return;
      }

      trackRematch("started", { surface: "home" });
      beginRematch(
        hub,
        {
          userId: outcome.opponentUserId,
          displayName: outcome.opponentName,
        },
        "home",
      );
      router.push(CREATE_MATCH_ROUTE);
    } catch {
      // The hub could not be read; the hub screen will show its own error.
      router.push(matchHubRoute(action.matchId));
    } finally {
      setRematchPending(false);
    }
  };

  const queryClient = useQueryClient();

  const refresh = () => {
    void invitesQuery.refetch();
    void matchesQuery.refetch();
    void completedQuery.refetch();
    void profileQuery.refetch();
    void notificationsQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["home-open-matches"] });
    void queryClient.invalidateQueries({
      queryKey: ["own-favorite-club-ids"],
    });
    void queryClient.invalidateQueries({ queryKey: ["own-availability"] });
  };

  const isRefreshing =
    invitesQuery.isRefetching ||
    matchesQuery.isRefetching ||
    completedQuery.isRefetching;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + tennisSpacing.screenBottom },
      ]}
      stickyHeaderIndices={[0]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
      }
    >
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.heroTop, { flexDirection: rowDirection }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.profile")}
            onPress={() => router.push(PROFILE_TAB_ROUTE)}
            style={[styles.heroIdentity, { flexDirection: rowDirection }]}
          >
            <Avatar
              name={displayName}
              avatarPath={profile?.avatar_path}
              size={64}
            />
            <View style={styles.heroText}>
              <AppText
                style={[styles.greeting, { writingDirection }]}
                maxLines={1}
              >
                {t("home.greeting", { name: displayName })}
              </AppText>
              <AppText
                style={[styles.heroMeta, { writingDirection }]}
                maxLines={1}
              >
                {t("home.heroStats", {
                  count: matchesPlayed,
                  band: playerProfile
                    ? t(`skillBandsShort.${playerProfile.skill_band}`)
                    : "—",
                })}
              </AppText>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notifications.centerTitle")}
            onPress={() => router.push("/notifications")}
            style={styles.bellButton}
          >
            <Icon
              name="notifications"
              size={20}
              color={tennisColors.primaryDark}
            />
            {unreadCount > 0 ? (
              <CountBadge
                label={formatTabBadgeCount(unreadCount) ?? String(unreadCount)}
                tone="violet"
                style={{ borderColor: tennisColors.card }}
              />
            ) : null}
          </Pressable>
        </View>

        {playerProfile ? (
          <HomeRatingCard
            provisional={showRatingProgress}
            ratedMatchCount={ratedMatchCount}
            remaining={ratingRemaining}
            ratingValue={ratingStatValue}
            awaitingScore={awaitingScore}
            onExplain={() =>
              notify(
                t("profile.ratingExplainerTitle"),
                t("profile.ratingExplainerBody"),
              )
            }
            onOpenAwaitingScore={() => router.push(MATCHES_ROUTE)}
          />
        ) : null}
      </View>

      <View style={styles.body}>
        {bodyError ? (
          <ScreenError
            message={t("home.loadError")}
            retryLabel={t("common.retry")}
            onRetry={refresh}
          />
        ) : null}

        {bodyLoading ? <ListSkeleton rows={3} /> : null}

        {!bodyLoading && !bodyError && nextActions.length > 0 ? (
          <View style={styles.section}>
            <HomeNextActionsCarousel
              actions={nextActions}
              onRematch={(pressed) => void startRematch(pressed)}
            />
          </View>
        ) : null}

        {!bodyLoading && !bodyError && firstPlayKind === "play" ? (
          <View style={styles.section}>
            <EmptyState
              icon="court"
              title={t("home.firstPlay.title")}
              body={t("home.firstPlay.body")}
              action={
                <View style={styles.emptyUpcoming}>
                  <FigmaPrimaryButton
                    label={t("home.openMatches.organise")}
                    onPress={() => startNewMatchCreate()}
                  />
                  <FigmaSecondaryButton
                    label={t("home.free.emptyCta")}
                    onPress={() => router.push(discoverOpenMatchesRoute())}
                  />
                </View>
              }
            />
          </View>
        ) : null}

        {!bodyLoading && !bodyError && !showFirstPlay ? (
          <View style={styles.section}>
            <HomeFreeSlots />
          </View>
        ) : null}

        {!bodyLoading && !bodyError && !showFirstPlay ? (
          <HomeOpenMatches />
        ) : null}

        {!bodyLoading && !bodyError && upcomingMatches.length > 0 ? (
          <View style={styles.section}>
            <AppText style={tennisTextStyles.sectionTitle}>
              {t("home.upcomingTitle")}
            </AppText>
            <View style={styles.sectionStack}>
              {upcomingMatches.slice(0, 2).map((match) => {
                const headlineInput = {
                  opponentNames: match.opponent_names,
                  status: match.status,
                  participantCount: match.participant_count,
                  capacity: match.capacity,
                };
                const opponent = resolveMatchCardOpponent(t, headlineInput);
                const locationChip = matchCardClubLabel({
                  clubName: match.club_name,
                  preferredClubs: match.preferred_clubs,
                  hasCourt: match.has_court,
                  courtSecuredFallback: t("matches.list.courtSecuredBadge"),
                  compact: true,
                });
                const areaChip = matchCardAreaLabel(match.zones, locale, {
                  compact: true,
                });
                const action = matchListAction({
                  status: match.status,
                  isCreator: match.is_creator,
                  participantStatus: match.participant_status,
                });

                return (
                  <MatchCard
                    key={match.match_id}
                    status={match.status}
                    statusLabel={t(`matches.status.${match.status}`)}
                    actionLabel={action ? t(action.labelKey) : undefined}
                    actionTone={action?.tone}
                    dateTimeLabel={(() => {
                      const startsAt = matchListStartsAt(match);
                      return startsAt
                        ? formatCompactUtcInBeirut(startsAt)
                        : undefined;
                    })()}
                    headline={buildMatchCardHeadline(t, headlineInput)}
                    viewerName={displayName}
                    viewerAvatarPath={profile?.avatar_path}
                    opponentName={opponent}
                    opponentAvatarColor={
                      opponent ? opponentAvatarColor(opponent) : undefined
                    }
                    formatChip={t(`formats.${match.format}`)}
                    locationChip={locationChip}
                    areaChip={areaChip}
                    badges={
                      match.is_stale_warning
                        ? [
                            {
                              label: t("matches.lifecycle.staleBadge"),
                              tone: "attention" as const,
                            },
                          ]
                        : undefined
                    }
                    onPress={() => router.push(matchHubRoute(match.match_id))}
                    onActionPress={
                      matchListActionOpensInvite({
                        status: match.status,
                        isCreator: match.is_creator,
                      })
                        ? () => router.push(matchInviteRoute(match.match_id))
                        : undefined
                    }
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

/**
 * `position: "sticky"` is a web CSS value React Native’s `ViewStyle` does not
 * model. The carousels cast their web-only scroll-snap styles the same way,
 * but those add properties `ViewStyle` simply lacks; `position` is one it
 * already has with an incompatible union, so TypeScript refuses a direct
 * assertion and the cast has to go through `unknown`.
 *
 * This read as `as const`, which asserts the literal rather than widening it,
 * and still type-checked here: `expo-env.d.ts` pulls in `expo/types`, which
 * widens the union. That file is generated by `expo start` and gitignored, so
 * CI never had it and failed on a line that passes locally.
 */
const webStickyHero: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ position: "sticky", top: 0 } as unknown as ViewStyle)
    : undefined;

const styles = createLiveSheet(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    content: {
      flexGrow: 1,
    },
    hero: {
      backgroundColor: tennisColors.background,
      paddingHorizontal: tennisSpacing.screenX,
      paddingBottom: tennisSpacing.section,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tennisColors.border,
      zIndex: 20,
      ...webStickyHero,
    },
    heroTop: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    heroIdentity: {
      flex: 1,
      alignItems: "center",
      gap: 12,
      minWidth: 0,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    greeting: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 20,
      color: tennisColors.primaryDark,
    },
    heroMeta: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    bellButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: tennisColors.card,
      borderWidth: 1,
      borderColor: tennisColors.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    body: {
      paddingHorizontal: tennisSpacing.screenX,
      paddingTop: tennisSpacing.section,
      gap: tennisSpacing.section,
    },
    section: {
      gap: tennisSpacing.sectionTitleContent,
    },
    sectionStack: {
      gap: 10,
    },
    emptyUpcoming: {
      gap: 12,
    },
    emptyText: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.mutedForeground,
    },
  }),
);
