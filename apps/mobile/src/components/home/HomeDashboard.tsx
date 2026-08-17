import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  getOwnPlayerProfile,
  listMyCompletedMatches,
  listMyMatchInvites,
  listMyMatches,
  listUserNotifications,
} from "@tennis-lebanon/api";
import {
  isProvisionalPlayerRating,
  PROVISIONAL_RATING_MATCH_THRESHOLD,
  ratedMatchesUntilRatingUnlock,
  ratingUnlockProgress,
} from "@tennis-lebanon/domain";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { ListSkeleton, MatchCard } from "../AppUi";
import { HomeNextActionCard } from "./HomeNextActionCard";
import { Icon, type IconName } from "../Icon";
import { formatCompactUtcInBeirut } from "../../lib/beirut-time";
import {
  buildMatchCardHeadline,
  resolveMatchCardOpponent,
} from "../../lib/match-card-headline";
import { matchCardAreaLabel, matchCardClubLabel } from "../../lib/match-clubs";
import { opponentAvatarColor } from "../../lib/match-card-status";
import { matchListAction, matchListStartsAt } from "../../lib/match-list-card";
import {
  deriveHomeNextActions,
  sortUpcomingMatches,
} from "../../lib/home-next-actions";
import { CLUBS_ROUTE, matchHubRoute } from "../../lib/routes";
import { useLayoutDirection } from "../../lib/layout-direction";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";
import {
  tennisColors,
  tennisRadii,
  tennisSpacing,
} from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function HomeDashboard({ displayName }: { displayName: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { profile } = useAuth();
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

  const unreadCount =
    notificationsQuery.data?.filter((item) => !item.read_at).length ?? 0;

  const nextActions = deriveHomeNextActions(
    invitesQuery.data ?? [],
    matchesQuery.data ?? [],
  );
  const upcomingMatches = sortUpcomingMatches(matchesQuery.data ?? []);
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

  const refresh = () => {
    void invitesQuery.refetch();
    void matchesQuery.refetch();
    void completedQuery.refetch();
    void profileQuery.refetch();
    void notificationsQuery.refetch();
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
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
      }
    >
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <View style={[styles.heroTop, { flexDirection: rowDirection }]}>
          <View style={[styles.heroText, tennisTextStyles.titleSubtitleBlock]}>
            <AppText style={[styles.greeting, { writingDirection }]}>
              {t("home.greeting", { name: displayName })}
            </AppText>
            <AppText
              style={[
                tennisTextStyles.pageSubtitleOnDark,
                { writingDirection },
              ]}
            >
              {t("home.subtitle")}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notifications.centerTitle")}
            onPress={() => router.push("/notifications")}
            style={styles.bellButton}
          >
            <Icon name="notifications" size={22} color={tennisColors.white} />
            {unreadCount > 0 ? (
              <View style={styles.bellBadge}>
                <AppText style={styles.bellBadgeText}>
                  {unreadCount > 9 ? "9+" : String(unreadCount)}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={[styles.statsRow, { flexDirection: rowDirection }]}>
          <View style={styles.statCard}>
            <AppText style={styles.statValue}>{matchesPlayed}</AppText>
            <AppText style={styles.statLabel}>
              {t("home.stats.matchesPlayed")}
            </AppText>
          </View>
          <View style={styles.statCard}>
            <AppText style={styles.statValue}>
              {playerProfile
                ? t(`skillBandsShort.${playerProfile.skill_band}`)
                : "—"}
            </AppText>
            <AppText style={styles.statLabel}>
              {showRatingProgress
                ? t("home.stats.provisionalBand")
                : t("home.stats.skillBand")}
            </AppText>
          </View>
        </View>

        {/* A provisional player has no number to look at and no sense of how
            far off one is. Naming the distance makes the wait finishable. */}
        {showRatingProgress ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t("home.ratingProgress.title")}
            accessibilityValue={{
              min: 0,
              max: PROVISIONAL_RATING_MATCH_THRESHOLD,
              now: ratedMatchCount,
              text: t("home.ratingProgress.remaining", {
                remaining: ratingRemaining,
              }),
            }}
            style={styles.ratingProgress}
          >
            <View
              style={[
                styles.ratingProgressTop,
                { flexDirection: rowDirection },
              ]}
            >
              <AppText
                style={[styles.ratingProgressTitle, { writingDirection }]}
                maxLines={1}
              >
                {t("home.ratingProgress.title")}
              </AppText>
              <AppText style={styles.ratingProgressCount}>
                {t("home.ratingProgress.progress", {
                  done: ratedMatchCount,
                  threshold: PROVISIONAL_RATING_MATCH_THRESHOLD,
                })}
              </AppText>
            </View>
            <View style={styles.ratingTrack}>
              <View
                style={[
                  styles.ratingFill,
                  { width: `${ratingUnlockProgress(ratedMatchCount) * 100}%` },
                ]}
              />
            </View>
            <AppText style={[styles.ratingProgressHint, { writingDirection }]}>
              {t("home.ratingProgress.remaining", {
                remaining: ratingRemaining,
              })}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {bodyError ? (
          <View style={styles.errorCard}>
            <AppText style={styles.errorText}>{t("home.loadError")}</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={refresh}
              style={styles.retryButton}
            >
              <AppText style={styles.retryLabel}>{t("common.retry")}</AppText>
            </Pressable>
          </View>
        ) : null}

        {bodyLoading ? <ListSkeleton rows={3} /> : null}

        {!bodyLoading && !bodyError && nextActions.length > 0 ? (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>
              {t("home.nextActionsTitle")}
            </AppText>
            {nextActions.map((action) => (
              <HomeNextActionCard key={action.id} action={action} />
            ))}
          </View>
        ) : null}

        {!bodyLoading && !bodyError ? (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>
              {t("home.quickActionsTitle")}
            </AppText>
            <View
              style={[styles.quickActionsGrid, { flexDirection: rowDirection }]}
            >
              <QuickActionTile
                label={t("home.quickActionFindPlayers")}
                icon="discover"
                backgroundColor="#7C3AED"
                onPress={() => router.push("/(tabs)/discover")}
              />
              <QuickActionTile
                label={t("home.quickActionBookCourt")}
                icon="clubs"
                backgroundColor="#2563EB"
                onPress={() => router.push(CLUBS_ROUTE)}
              />
            </View>
          </View>
        ) : null}

        {!bodyLoading && !bodyError ? (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>
              {t("home.upcomingTitle")}
            </AppText>
            {upcomingMatches.length === 0 ? (
              <AppText style={styles.emptyText}>
                {t("home.upcomingEmpty")}
              </AppText>
            ) : (
              upcomingMatches.map((match) => {
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
                  />
                );
              })
            )}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function QuickActionTile({
  label,
  icon,
  backgroundColor,
  onPress,
}: {
  label: string;
  icon: IconName;
  backgroundColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionTile,
        { backgroundColor },
        pressed && { opacity: 0.92 },
      ]}
    >
      <Icon name={icon} size={24} color={tennisColors.white} />
      <AppText style={styles.quickActionLabel}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  content: {
    flexGrow: 1,
  },
  hero: {
    backgroundColor: tennisColors.primary,
    paddingHorizontal: tennisSpacing.screenX,
    paddingBottom: 24,
    borderBottomLeftRadius: tennisRadii.hero,
    borderBottomRightRadius: tennisRadii.hero,
  },
  heroTop: {
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  heroText: {
    flex: 1,
  },
  greeting: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 28,
    color: tennisColors.white,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tennisColors.heroOverlay,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: tennisColors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: tennisColors.white,
    fontSize: 10,
    fontFamily: tennisFontFamily.bodySemi,
  },
  statsRow: {
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: tennisColors.heroOverlay,
    borderRadius: tennisRadii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: tennisColors.heroBorder,
  },
  statValue: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 22,
    color: tennisColors.lime,
  },
  statLabel: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  ratingProgress: {
    marginTop: 12,
    gap: 8,
    padding: 14,
    borderRadius: tennisRadii.lg,
    backgroundColor: tennisColors.heroOverlay,
    borderWidth: 1,
    borderColor: tennisColors.heroBorder,
  },
  ratingProgressTop: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ratingProgressTitle: {
    flexShrink: 1,
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 14,
    color: tennisColors.white,
  },
  ratingProgressCount: {
    flexShrink: 0,
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 14,
    color: tennisColors.lime,
  },
  ratingTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  ratingFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: tennisColors.lime,
  },
  ratingProgressHint: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.8)",
  },
  body: {
    paddingHorizontal: tennisSpacing.screenX,
    paddingTop: 20,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 18,
    color: tennisColors.primaryDark,
  },
  emptyText: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
  },
  loadingBody: {
    paddingVertical: 32,
    alignItems: "center",
  },
  errorCard: {
    gap: 12,
    padding: 16,
    borderRadius: tennisRadii.lg,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  errorText: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.primaryDark,
  },
  retryButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  retryLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 15,
    color: tennisColors.primary,
  },
  quickActionsGrid: {
    gap: 10,
  },
  quickActionTile: {
    flex: 1,
    minHeight: 88,
    borderRadius: tennisRadii.xl,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 10,
    justifyContent: "flex-end",
    shadowColor: "#0D1117",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  quickActionLabel: {
    fontFamily: tennisFontFamily.heading,
    fontSize: 14,
    color: tennisColors.white,
    letterSpacing: -0.2,
  },
});
