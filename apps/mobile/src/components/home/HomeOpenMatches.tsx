import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  discoverOpenMatches,
  listOwnFavoriteClubIds,
  type OpenMatchCard,
} from "@tennis-lebanon/api";
import { canShowJoinAction } from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { MatchCard } from "../AppUi";
import {
  compactJoinedLabel,
  clubNamesFromList,
  matchCardAreaLabel,
} from "../../lib/match-clubs";
import { opponentAvatarColor } from "../../lib/match-card-status";
import { matchHubLevelSummary } from "../../lib/match-hub-summaries";
import { openMatchCardDateTimeLabel } from "../../lib/open-match-card-time";
import { pickHomeOpenMatches } from "../../lib/home-open-matches";
import { useLayoutDirection } from "../../lib/layout-direction";
import { discoverOpenMatchesRoute, matchHubRoute } from "../../lib/routes";
import { supabase } from "../../lib/supabase";
import { tennisColors, tennisSpacing } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

const FETCH_LIMIT = 20;

function OpenMatchHomeCard({
  match,
  locale,
}: {
  match: OpenMatchCard;
  locale: string;
}) {
  const { t } = useTranslation();
  const preferredClubLabel = compactJoinedLabel(
    clubNamesFromList(match.preferred_clubs),
    2,
  );
  const areaLabel = matchCardAreaLabel(match.zones, locale, { compact: true });
  const dateTimeLabel = openMatchCardDateTimeLabel(match);
  const joinAction = canShowJoinAction({
    matchStatus: match.status,
    requiresCreatorApproval: match.requires_creator_approval,
  });
  const joinLabel =
    joinAction === "join"
      ? t("matches.list.action.join")
      : joinAction === "request"
        ? t("matches.list.action.requestJoin")
        : undefined;

  return (
    <MatchCard
      status={match.status}
      statusLabel={t(`matches.status.${match.status}`)}
      actionLabel={joinLabel}
      actionTone="actionable"
      dateTimeLabel={dateTimeLabel}
      headline={match.creator_display_name}
      hostName={match.creator_display_name}
      hostAvatarPath={match.creator_avatar_path}
      hostAvatarColor={opponentAvatarColor(match.creator_display_name)}
      formatChip={t(`formats.${match.format}`)}
      locationChip={preferredClubLabel}
      areaChip={areaLabel}
      levelChip={matchHubLevelSummary(
        { min_skill: match.min_skill, max_skill: match.max_skill },
        t,
      )}
      note={match.notes ?? undefined}
      onPress={() => router.push(matchHubRoute(match.match_id))}
    />
  );
}

export function HomeOpenMatches() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { rowDirection, writingDirection } = useLayoutDirection();

  const clubsQuery = useQuery({
    queryKey: ["own-favorite-club-ids"],
    queryFn: () => listOwnFavoriteClubIds(supabase),
    staleTime: 60_000,
  });

  const matchesQuery = useQuery({
    queryKey: ["home-open-matches"],
    queryFn: () => discoverOpenMatches(supabase, { limit: FETCH_LIMIT }),
    staleTime: 60_000,
  });

  const matches = pickHomeOpenMatches(
    matchesQuery.data ?? [],
    clubsQuery.data ?? [],
  );

  if (matchesQuery.isError || clubsQuery.isError) {
    return null;
  }

  if (matchesQuery.isPending || clubsQuery.isPending) {
    return null;
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <AppText
          style={[styles.title, { writingDirection, flex: 1 }]}
          maxLines={1}
        >
          {t("home.openMatches.title")}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.openMatches.viewAllA11y")}
          onPress={() => router.push(discoverOpenMatchesRoute())}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.viewAll,
            pressed && styles.viewAllPressed,
          ]}
        >
          <AppText style={styles.viewAllLabel}>
            {t("home.openMatches.viewAll")}
          </AppText>
        </Pressable>
      </View>
      <View style={styles.stack}>
        {matches.map((openMatch) => (
          <OpenMatchHomeCard
            key={openMatch.match_id}
            match={openMatch}
            locale={locale}
          />
        ))}
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    root: {
      gap: tennisSpacing.sectionTitleContent,
    },
    stack: {
      gap: 10,
    },
    header: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    title: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 18,
      color: tennisColors.primaryDark,
    },
    viewAll: {
      justifyContent: "center",
    },
    viewAllPressed: {
      opacity: 0.7,
    },
    viewAllLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 15,
      color: tennisColors.violet,
    },
  }),
);
