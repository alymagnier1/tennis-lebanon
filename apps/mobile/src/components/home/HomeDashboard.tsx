import {
  ActivityIndicator,
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
import { isProvisionalPlayerRating } from "@tennis-lebanon/domain";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../AppText";
import { MatchCard } from "../AppUi";
import { FigmaPrimaryButton } from "../onboarding-ui";
import { Icon } from "../Icon";
import { formatUtcInBeirut } from "../../lib/beirut-time";
import {
  deriveHomeNextActions,
  sortUpcomingMatches,
} from "../../lib/home-next-actions";
import { homeNextActionRoute, matchHubRoute } from "../../lib/routes";
import { CREATE_MATCH_ROUTE } from "../../lib/routes";
import { useLayoutDirection } from "../../lib/layout-direction";
import { supabase } from "../../lib/supabase";
import {
  tennisColors,
  tennisRadii,
  tennisSpacing,
} from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function HomeDashboard({ displayName }: { displayName: string }) {
  const { t } = useTranslation();
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

  const isLoading =
    invitesQuery.isLoading ||
    matchesQuery.isLoading ||
    completedQuery.isLoading ||
    profileQuery.isLoading;

  const unreadCount =
    notificationsQuery.data?.filter((item) => !item.read_at).length ?? 0;

  const nextActions = deriveHomeNextActions(
    invitesQuery.data ?? [],
    matchesQuery.data ?? [],
  );
  const upcomingMatches = sortUpcomingMatches(matchesQuery.data ?? []);
  const playerProfile = profileQuery.data;
  const matchesPlayed = completedQuery.data?.length ?? 0;

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

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={tennisColors.lime} />
      </View>
    );
  }

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
          <View style={styles.heroText}>
            <AppText style={[styles.greeting, { writingDirection }]}>
              {t("home.greeting", { name: displayName })}
            </AppText>
            <AppText style={[styles.heroSubtitle, { writingDirection }]}>
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
              {playerProfile &&
              isProvisionalPlayerRating(playerProfile.rated_match_count)
                ? t("home.stats.provisionalBand")
                : t("home.stats.skillBand")}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {nextActions.length > 0 ? (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>
              {t("home.nextActionsTitle")}
            </AppText>
            {nextActions.map((action) => (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push(homeNextActionRoute(action.kind, action.matchId))
                }
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && styles.actionCardPressed,
                ]}
              >
                <AppText style={styles.actionTitle}>
                  {t(action.titleKey)}
                </AppText>
                <AppText style={styles.actionBody}>
                  {t(action.bodyKey, action.bodyParams)}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>
            {t("home.upcomingTitle")}
          </AppText>
          {upcomingMatches.length === 0 ? (
            <AppText style={styles.emptyText}>
              {t("home.upcomingEmpty")}
            </AppText>
          ) : (
            upcomingMatches.map((match) => (
              <MatchCard
                key={match.match_id}
                title={`${t(`formats.${match.format}`)} · ${t(`matches.status.${match.status}`)}`}
                subtitle={
                  match.soonest_time
                    ? formatUtcInBeirut(match.soonest_time)
                    : t("home.noTimeYet")
                }
                meta={`${match.participant_count}/${match.capacity} ${t("home.players")}`}
                badge={match.is_creator ? t("matches.list.creator") : undefined}
                onPress={() => router.push(matchHubRoute(match.match_id))}
              />
            ))
          )}
        </View>

        <FigmaPrimaryButton
          label={t("matches.create.cta")}
          onPress={() => router.push(CREATE_MATCH_ROUTE)}
        />
      </View>
    </ScrollView>
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tennisColors.background,
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
    gap: 4,
  },
  greeting: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 28,
    color: tennisColors.white,
  },
  heroSubtitle: {
    fontFamily: tennisFontFamily.body,
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
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
  actionCard: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: tennisColors.border,
    gap: 4,
  },
  actionCardPressed: {
    opacity: 0.9,
  },
  actionTitle: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 16,
    color: tennisColors.primaryDark,
  },
  actionBody: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
  },
  emptyText: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.mutedForeground,
  },
  refreshHint: {
    marginTop: 8,
  },
  refreshLink: {
    textAlign: "center",
    color: tennisColors.primary,
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
  },
});
