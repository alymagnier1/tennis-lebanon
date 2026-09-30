import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { type OpenMatchCard } from "@tennis-lebanon/api";
import { canShowJoinAction } from "@tennis-lebanon/domain";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { Avatar, ListSkeleton, MatchCard } from "../AppUi";
import { ScreenError } from "../FormUi";
import {
  compactJoinedLabel,
  clubNamesFromList,
  matchCardAreaLabel,
} from "../../lib/match-clubs";
import { opponentAvatarColor } from "../../lib/match-card-status";
import { matchHubLevelSummary } from "../../lib/match-hub-summaries";
import { openMatchCardDateTimeLabel } from "../../lib/open-match-card-time";
import { openMatchScarcityBadges } from "../../lib/open-match-scarcity";
import { useLayoutDirection } from "../../lib/layout-direction";
import { discoverOpenMatchesRoute, matchHubRoute } from "../../lib/routes";
import { useHomeOpenMatchPicks } from "../../hooks/useHomeOpenMatchPicks";
import { shortPlayerName } from "../../lib/home-v5";
import {
  tennisColors,
  tennisSemantic,
  tennisSpacing,
} from "../../theme/tennis-tokens";
import { tennisTextStyles } from "../../theme/tennis-text-styles";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

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
      badges={openMatchScarcityBadges(match, {
        oneSpotLeft: t("discover.spotsRemaining", { count: 1 }),
        courtSecured: t("discover.courtSecuredBadge"),
      })}
      note={match.notes ?? undefined}
      onPress={() => router.push(matchHubRoute(match.match_id))}
    />
  );
}

/**
 * Home v5 listing: when and what on top, the host and a Join cue below. The
 * whole card opens the hub, where joining happens, as on the classic card.
 */
function OpenMatchHomeCardV5({
  match,
  locale,
}: {
  match: OpenMatchCard;
  locale: string;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const areaLabel = matchCardAreaLabel(match.zones, locale, { compact: true });
  const dateTimeLabel =
    openMatchCardDateTimeLabel(match) ?? t("home.noTimeYet");
  const facts = [t(`formats.${match.format}`), areaLabel]
    .filter(Boolean)
    .join(" · ");
  const hostName = shortPlayerName(match.creator_display_name);
  const level = matchHubLevelSummary(
    { min_skill: match.min_skill, max_skill: match.max_skill },
    t,
  );
  const badge = openMatchScarcityBadges(match, {
    oneSpotLeft: t("discover.spotsRemaining", { count: 1 }),
    courtSecured: t("discover.courtSecuredBadge"),
  })?.[0];
  const badgePalette = badge ? tennisSemantic[badge.tone] : undefined;
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        dateTimeLabel,
        facts,
        [hostName, level].filter(Boolean).join(", "),
        badge?.label,
      ]
        .filter(Boolean)
        .join(". ")}
      accessibilityHint={joinLabel}
      onPress={() => router.push(matchHubRoute(match.match_id))}
      style={({ pressed }) => [styles.cardV5, pressed && styles.viewAllPressed]}
    >
      <View style={[styles.cardV5Top, { flexDirection: rowDirection }]}>
        <View style={styles.cardV5Text}>
          <AppText style={[styles.timeV5, { writingDirection }]} maxLines={1}>
            {dateTimeLabel}
          </AppText>
          <AppText style={[styles.factsV5, { writingDirection }]} maxLines={1}>
            {facts}
          </AppText>
        </View>
        {badge && badgePalette ? (
          <View style={[styles.tagV5, { backgroundColor: badgePalette.fill }]}>
            <AppText
              style={[styles.tagV5Label, { color: badgePalette.text }]}
              maxLines={1}
            >
              {badge.label}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={[styles.cardV5Foot, { flexDirection: rowDirection }]}>
        <View style={[styles.hostV5, { flexDirection: rowDirection }]}>
          <Avatar
            name={match.creator_display_name}
            avatarPath={match.creator_avatar_path}
            size={32}
            borderRadius={8}
          />
          <AppText
            style={[styles.hostV5Label, { writingDirection }]}
            maxLines={1}
          >
            <AppText style={styles.hostV5Name}>{hostName}</AppText>
            {level ? ` · ${level}` : ""}
          </AppText>
        </View>
        {joinLabel ? (
          <View style={styles.joinV5}>
            <AppText style={styles.joinV5Label} maxLines={1}>
              {joinLabel}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function HomeOpenMatches({
  layout = "classic",
}: {
  /** "v5": plain "Open matches" title and the compact host-and-Join card. */
  layout?: "classic" | "v5";
} = {}) {
  const isV5 = layout === "v5";
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { rowDirection, writingDirection } = useLayoutDirection();
  const { clubsQuery, matchesQuery, matches } = useHomeOpenMatchPicks();

  if (matchesQuery.isError || clubsQuery.isError) {
    return (
      <View style={styles.root}>
        <AppText style={[tennisTextStyles.sectionTitle, { writingDirection }]}>
          {t("home.openMatches.title")}
        </AppText>
        <ScreenError
          message={t("home.loadError")}
          retryLabel={t("home.openMatches.retry")}
          onRetry={() => {
            void matchesQuery.refetch();
            void clubsQuery.refetch();
          }}
        />
      </View>
    );
  }

  if (matchesQuery.isPending || clubsQuery.isPending) {
    return (
      <View style={styles.root}>
        <AppText style={[tennisTextStyles.sectionTitle, { writingDirection }]}>
          {t("home.openMatches.title")}
        </AppText>
        <ListSkeleton rows={2} />
      </View>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <AppText
          style={[tennisTextStyles.sectionTitle, { writingDirection, flex: 1 }]}
          maxLines={1}
        >
          {isV5
            ? t("home.openMatches.title")
            : t("home.openMatches.titleCount", { count: matches.length })}
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
        {matches.map((openMatch) =>
          isV5 ? (
            <OpenMatchHomeCardV5
              key={openMatch.match_id}
              match={openMatch}
              locale={locale}
            />
          ) : (
            <OpenMatchHomeCard
              key={openMatch.match_id}
              match={openMatch}
              locale={locale}
            />
          ),
        )}
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
    viewAll: {
      justifyContent: "center",
    },
    viewAllPressed: {
      opacity: 0.7,
    },
    viewAllLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 15,
      color: tennisColors.violetText,
    },
    cardV5: {
      padding: 16,
      gap: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
    },
    cardV5Top: {
      alignItems: "flex-start",
      gap: 10,
    },
    cardV5Text: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    timeV5: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 19,
      lineHeight: 24,
      color: tennisColors.primaryDark,
    },
    factsV5: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 19,
      color: tennisColors.mutedForeground,
    },
    tagV5: {
      flexShrink: 0,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    tagV5Label: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 12,
      lineHeight: 16,
    },
    cardV5Foot: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    hostV5: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 10,
    },
    hostV5Label: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 19,
      color: tennisColors.mutedForeground,
    },
    hostV5Name: {
      fontFamily: tennisFontFamily.bodySemi,
      color: tennisColors.primaryDark,
    },
    joinV5: {
      minHeight: minTouchTargetPx,
      minWidth: 110,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      backgroundColor: tennisColors.lime,
    },
    joinV5Label: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 15,
      color: tennisColors.limeText,
    },
  }),
);
