import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  countUnreadNotifications,
  getOwnPlayerProfile,
  listMyCompletedMatches,
  listMyMatchInvites,
  listMyMatches,
  listOwnAvailability,
} from "@tennis-lebanon/api";
import {
  PROVISIONAL_RATING_MATCH_THRESHOLD,
  isProvisionalPlayerRating,
} from "@tennis-lebanon/domain";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { Avatar, EmptyState, ListSkeleton } from "../AppUi";
import { ScreenError } from "../FormUi";
import { CountBadge } from "../CountBadge";
import { Icon } from "../Icon";
import { FigmaPrimaryButton, FigmaSecondaryButton } from "../onboarding-ui";
import { HomeFreeSlots } from "./HomeFreeSlots";
import { HomeOpenMatches } from "./HomeOpenMatches";
import { HomeTodoCard } from "./HomeTodoCard";
import { HomeNextMatchBoard } from "./HomeNextMatchBoard";
import { HomeSetupNudge } from "./HomeSetupNudge";
import { formatCompactUtcInBeirut } from "../../lib/beirut-time";
import { formatTabBadgeCount } from "../../lib/match-list-card";
import {
  deriveHomeNextActions,
  sortUpcomingMatches,
  type HomeNextAction,
} from "../../lib/home-next-actions";
import {
  homeSetupNudge,
  homeTodoActions,
  homeTodoContext,
  ratingPips,
} from "../../lib/home-v5";
import { homeFirstPlayKind } from "../../lib/home-first-play";
import { matchCardAreaLabel } from "../../lib/match-clubs";
import { trackRematch } from "../../lib/analytics";
import { beginRematch } from "../../lib/rematch-draft";
import { resolveRematchTarget } from "../../lib/start-rematch";
import {
  CREATE_MATCH_ROUTE,
  MATCHES_ROUTE,
  discoverOpenMatchesRoute,
  homeNextActionRoute,
  matchHubRoute,
} from "../../lib/routes";
import { startNewMatchCreate } from "../../lib/create-match-guard";
import { useLayoutDirection } from "../../lib/layout-direction";
import { PROFILE_TAB_ROUTE } from "../../lib/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";
import { notify } from "../../lib/confirm-action";
import { profileScreenRatingStatValue } from "../../lib/profile-screen-copy";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useHomeOpenMatchPicks } from "../../hooks/useHomeOpenMatchPicks";
import { useHomeLiquidityOffers } from "../../hooks/useHomeLiquidityOffers";

/**
 * Home, v5 layout (docs/mockups/home-redesign-v5.html): who you are, what is
 * waiting on you, your next match, who is free, and open matches. The classic
 * `HomeDashboard` is kept as the fallback; `app/(tabs)/index.tsx` picks one.
 */
export function HomeDashboardV5({ displayName }: { displayName: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { profile, session } = useAuth();
  const insets = useSafeAreaInsets();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const queryClient = useQueryClient();

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
  const unreadQuery = useQuery({
    queryKey: ["user-notifications-unread"],
    queryFn: () => countUnreadNotifications(supabase),
  });
  const availabilityQuery = useQuery({
    queryKey: ["own-availability", session?.user.id],
    queryFn: () => listOwnAvailability(supabase),
    enabled: Boolean(session?.user.id),
    staleTime: 60_000,
  });
  const openMatchPicks = useHomeOpenMatchPicks();
  const liquidityOffers = useHomeLiquidityOffers();

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

  const invites = invitesQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  const completed = completedQuery.data ?? [];
  const boardMatch = sortUpcomingMatches(matches)[0] ?? null;
  const todos = homeTodoActions(
    deriveHomeNextActions(
      invites,
      matches,
      completed,
      new Date().toISOString(),
    ),
    boardMatch?.match_id ?? null,
  );

  const setupReady =
    (!availabilityQuery.isEnabled || !availabilityQuery.isPending) &&
    !openMatchPicks.clubsQuery.isPending &&
    !availabilityQuery.isError &&
    !openMatchPicks.clubsQuery.isError;
  const nudge = homeSetupNudge(
    setupReady
      ? {
          hasAvailability: (availabilityQuery.data?.length ?? 0) > 0,
          hasFavoriteClubs: (openMatchPicks.clubsQuery.data?.length ?? 0) > 0,
        }
      : undefined,
  );

  const firstPlayKind = homeFirstPlayKind({
    hasHeroAction: todos.length > 0 || nudge !== null,
    upcomingCount: boardMatch ? 1 : 0,
    openMatchCount: openMatchPicks.matches.length,
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
  const ratedMatchCount = playerProfile?.rated_match_count ?? 0;
  const provisional = isProvisionalPlayerRating(ratedMatchCount);
  const bandLabel = playerProfile
    ? t(`skillBands.${playerProfile.skill_band}`)
    : "";
  const ratingValue = playerProfile
    ? profileScreenRatingStatValue(
        playerProfile.rated_match_count,
        playerProfile.internal_rating,
      )
    : "";
  const standingA11y = provisional
    ? `${bandLabel}. ${t("home.ratingProgress.progress", {
        done: Math.min(ratedMatchCount, PROVISIONAL_RATING_MATCH_THRESHOLD),
        threshold: PROVISIONAL_RATING_MATCH_THRESHOLD,
      })}. ${t("profile.ratingExplainerTitle")}`
    : `${bandLabel}, ${ratingValue}. ${t("profile.ratingExplainerTitle")}`;
  const unreadCount = unreadQuery.data ?? 0;

  const todoFacts = (action: HomeNextAction): string | null => {
    const context = homeTodoContext(action, { invites, matches, completed });
    if (!context) return null;
    const place =
      context.clubName ??
      matchCardAreaLabel(context.zones, locale, { compact: true });
    const parts = [
      context.startsAt ? formatCompactUtcInBeirut(context.startsAt) : null,
      place,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  /** Same as classic Home: the hub is fetched on tap to seed the draft. */
  const [rematchPending, setRematchPending] = useState(false);
  const startRematch = async (action: HomeNextAction) => {
    const viewerUserId = session?.user.id;
    if (!viewerUserId || rematchPending || !action.matchId) return;

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
        { userId: outcome.opponentUserId, displayName: outcome.opponentName },
        "home",
      );
      router.push(CREATE_MATCH_ROUTE);
    } catch {
      router.push(matchHubRoute(action.matchId));
    } finally {
      setRematchPending(false);
    }
  };

  const openTodo = (action: HomeNextAction) => {
    if (action.kind === "rematch") {
      void startRematch(action);
      return;
    }
    router.push(homeNextActionRoute(action.kind, action.matchId));
  };

  const refresh = () => {
    void invitesQuery.refetch();
    void matchesQuery.refetch();
    void completedQuery.refetch();
    void profileQuery.refetch();
    void unreadQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["home-open-matches"] });
    void queryClient.invalidateQueries({ queryKey: ["own-favorite-club-ids"] });
    void queryClient.invalidateQueries({ queryKey: ["own-availability"] });
    void queryClient.invalidateQueries({
      queryKey: ["availability-liquidity"],
    });
    void queryClient.invalidateQueries({ queryKey: ["home-free-players"] });
  };

  const isRefreshing =
    invitesQuery.isRefetching ||
    matchesQuery.isRefetching ||
    completedQuery.isRefetching;
  const ready = !bodyLoading && !bodyError;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + tennisSpacing.screenBottom,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
      }
    >
      <View style={styles.headerBlock}>
        <View style={[styles.header, { flexDirection: rowDirection }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.profile")}
            onPress={() => router.push(PROFILE_TAB_ROUTE)}
            hitSlop={4}
          >
            <Avatar
              name={displayName}
              avatarPath={profile?.avatar_path}
              size={52}
            />
          </Pressable>
          <View style={styles.headerText}>
            <AppText
              accessibilityRole="header"
              style={[styles.hello, { writingDirection }]}
              maxLines={1}
            >
              {t("home.greeting", { name: displayName })}
            </AppText>
            {playerProfile ? (
              <AppText
                style={[styles.standingText, { writingDirection }]}
                maxLines={1}
              >
                {bandLabel}
              </AppText>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notifications.centerTitle")}
            onPress={() => router.push("/notifications")}
            style={styles.bell}
          >
            <Icon
              name="notifications"
              size={22}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={standingA11y}
            onPress={() =>
              notify(
                t("profile.ratingExplainerTitle"),
                t("profile.ratingExplainerBody"),
              )
            }
            style={[styles.standing, { flexDirection: rowDirection }]}
          >
            {provisional ? (
              <View style={[styles.pips, { flexDirection: rowDirection }]}>
                {ratingPips(
                  ratedMatchCount,
                  PROVISIONAL_RATING_MATCH_THRESHOLD,
                ).map((on, index) => (
                  <View key={index} style={[styles.pip, on && styles.pipOn]} />
                ))}
              </View>
            ) : null}
            <AppText style={styles.standingRating} maxLines={1}>
              {provisional
                ? t("home.ratingProgress.short", {
                    done: Math.min(
                      ratedMatchCount,
                      PROVISIONAL_RATING_MATCH_THRESHOLD,
                    ),
                    threshold: PROVISIONAL_RATING_MATCH_THRESHOLD,
                  })
                : ratingValue}
            </AppText>
            <Icon name="info" size={20} color={tennisColors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {bodyError ? (
        <ScreenError
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={refresh}
        />
      ) : null}

      {bodyLoading ? <ListSkeleton rows={3} /> : null}

      {ready && todos.length > 0 ? (
        <HomeTodoCard
          actions={todos}
          factsFor={todoFacts}
          onPress={openTodo}
          onMore={() => router.push(MATCHES_ROUTE)}
        />
      ) : null}

      {ready && boardMatch ? (
        <HomeNextMatchBoard
          match={boardMatch}
          viewerName={displayName}
          viewerAvatarPath={profile?.avatar_path}
        />
      ) : null}

      {ready && showFirstPlay ? (
        <EmptyState
          icon="court"
          title={t("home.firstPlay.title")}
          body={t("home.firstPlay.body")}
          action={
            <View style={styles.firstPlayActions}>
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
      ) : null}

      {ready && !showFirstPlay ? (
        <View style={styles.sectionGroup}>
          <HomeFreeSlots layout="v5" />
          {nudge === "availability" ? (
            <HomeSetupNudge kind="availability" />
          ) : null}
        </View>
      ) : null}

      {ready && !showFirstPlay ? (
        <View style={styles.sectionGroup}>
          <HomeOpenMatches layout="v5" />
          {nudge === "favoriteClubs" ? (
            <HomeSetupNudge kind="favoriteClubs" />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tennisColors.background,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: tennisSpacing.screenX,
      gap: tennisSpacing.section,
    },
    headerBlock: {
      gap: 8,
    },
    header: {
      alignItems: "center",
      gap: 12,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    hello: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 26,
      lineHeight: 32,
      color: tennisColors.primaryDark,
    },
    standing: {
      alignItems: "center",
      gap: 12,
      minHeight: 44,
    },
    standingText: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.mutedForeground,
    },
    standingRating: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 22,
      lineHeight: 28,
      color: tennisColors.primaryDark,
    },
    pips: {
      flex: 1,
      gap: 6,
      alignItems: "center",
    },
    pip: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: tennisColors.linkUnderline,
    },
    pipOn: {
      backgroundColor: tennisColors.violet,
    },
    bell: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: tennisColors.card,
      borderWidth: 1,
      borderColor: tennisColors.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    firstPlayActions: {
      gap: 12,
    },
    sectionGroup: {
      gap: 12,
    },
  }),
);
