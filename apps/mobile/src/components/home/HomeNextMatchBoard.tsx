import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { MyMatchRow } from "@tennis-lebanon/api";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { beirutDateKey, formatUtcTimeInBeirut } from "../../lib/beirut-time";
import { beirutDayOffset } from "../../lib/home-v5";
import { matchCardAreaLabel, matchCardClubLabel } from "../../lib/match-clubs";
import {
  matchListAction,
  matchListActionOpensInvite,
  matchListStartsAt,
} from "../../lib/match-list-card";
import { openMatchSpotsLeft } from "../../lib/open-match-scarcity";
import { weekdayIndexFromBeirutDateKey } from "../../lib/near-term-availability";
import { matchHubRoute, matchInviteRoute } from "../../lib/routes";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisHeroArt } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { Icon } from "../Icon";

const SEAT = 34;

/**
 * The next match as a scoreboard: when, what and where, who is in, and the one
 * thing to do about it. Fixed green artwork in both themes, like the hero art,
 * so the lime clock keeps its contrast.
 */
export function HomeNextMatchBoard({
  match,
  viewerName,
  viewerAvatarPath,
}: {
  match: MyMatchRow;
  viewerName: string;
  viewerAvatarPath?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { rowDirection, writingDirection } = useLayoutDirection();

  const startsAt = matchListStartsAt(match);
  const eyebrow = startsAt
    ? t("home.board.eyebrow", { day: dayLabel(startsAt) })
    : t("home.board.eyebrowNoTime");
  const clock = startsAt
    ? formatUtcTimeInBeirut(startsAt)
    : t("home.noTimeYet");
  const place =
    matchCardClubLabel({
      clubName: match.club_name,
      preferredClubs: match.preferred_clubs,
      compact: true,
    }) ?? matchCardAreaLabel(match.zones, locale, { compact: true });
  const facts = [t(`formats.${match.format}`), place]
    .filter(Boolean)
    .join(" · ");

  const spotsLeft = openMatchSpotsLeft(match.participant_count, match.capacity);
  const needsPlayers = match.status === "open" && spotsLeft > 0;
  const statusText = needsPlayers
    ? t("discover.spotsRemaining", { count: spotsLeft })
    : match.has_court
      ? t("discover.courtSecuredBadge")
      : t(`matches.status.${match.status}`);

  const action = matchListAction({
    status: match.status,
    isCreator: match.is_creator,
    participantStatus: match.participant_status,
  });
  const opensInvite = matchListActionOpensInvite({
    status: match.status,
    isCreator: match.is_creator,
  });
  const opponent = match.opponent_names?.split(",")[0]?.trim() || null;

  function dayLabel(iso: string): string {
    const offset = beirutDayOffset(iso, new Date().toISOString());
    if (offset === 0) return t("discover.today");
    if (offset === 1) return t("discover.tomorrow");
    const weekday = t(
      `availability.weekdays.${weekdayIndexFromBeirutDateKey(beirutDateKey(iso))}`,
    );
    return weekday.charAt(0).toLocaleUpperCase(locale) + weekday.slice(1);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}. ${clock}. ${facts}. ${statusText}`}
      onPress={() => router.push(matchHubRoute(match.match_id))}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[tennisHeroArt.heroGreen, tennisHeroArt.heroGreenDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.board}
      >
        {/* The button has its own row: beside the text it took ~160pt, which
            cut the day, the time and the club on smaller phones (founder,
            2026-10-04). */}
        <View style={[styles.top, { flexDirection: rowDirection }]}>
          <View style={styles.left}>
            <AppText
              style={[styles.eyebrow, { writingDirection }]}
              maxLines={1}
            >
              {eyebrow}
            </AppText>
            <AppText
              style={[
                startsAt ? styles.clock : styles.clockPending,
                { writingDirection },
              ]}
              maxLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {clock}
            </AppText>
            <AppText style={[styles.sub, { writingDirection }]} maxLines={1}>
              {facts}
            </AppText>
            <AppText
              style={[
                styles.sub,
                needsPlayers ? styles.need : styles.ok,
                { writingDirection },
              ]}
              maxLines={1}
            >
              {statusText}
            </AppText>
          </View>

          <View style={styles.right}>
            <View
              style={[styles.seats, { flexDirection: rowDirection }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View style={styles.seatRing}>
                <Avatar
                  name={viewerName}
                  avatarPath={viewerAvatarPath}
                  size={SEAT}
                />
              </View>
              {needsPlayers ? (
                Array.from({ length: Math.min(spotsLeft, 3) }, (_, index) => (
                  <View key={index} style={[styles.openSeat, styles.overlap]} />
                ))
              ) : opponent ? (
                <View style={[styles.seatRing, styles.overlap]}>
                  <Avatar name={opponent} size={SEAT} />
                </View>
              ) : null}
            </View>
            {opensInvite && action ? null : (
              <Icon name="chevron" size={22} color={tennisHeroArt.heroMint} />
            )}
          </View>
        </View>
        {opensInvite && action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(action.labelKey)}
            onPress={() => router.push(matchInviteRoute(match.match_id))}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <AppText style={styles.ctaLabel} maxLines={1}>
              {t(action.labelKey)}
            </AppText>
          </Pressable>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    pressable: {
      borderRadius: 22,
    },
    pressed: {
      opacity: 0.9,
    },
    board: {
      borderRadius: 22,
      paddingVertical: 16,
      paddingStart: 18,
      paddingEnd: 16,
      gap: 14,
    },
    top: {
      gap: 12,
      alignItems: "center",
    },
    left: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    eyebrow: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: tennisHeroArt.heroMint,
    },
    clock: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 40,
      lineHeight: 46,
      color: tennisColors.lime,
    },
    clockPending: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 24,
      lineHeight: 32,
      color: tennisColors.lime,
    },
    sub: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 19,
      color: tennisColors.white,
    },
    need: {
      fontFamily: tennisFontFamily.bodySemi,
      color: tennisHeroArt.heroClay,
    },
    ok: {
      color: tennisHeroArt.heroMint,
    },
    right: {
      alignItems: "flex-end",
      gap: 12,
      flexShrink: 0,
    },
    seats: {
      alignItems: "center",
    },
    seatRing: {
      borderRadius: SEAT,
      borderWidth: 2,
      borderColor: tennisHeroArt.heroGreen,
    },
    openSeat: {
      width: SEAT + 4,
      height: SEAT + 4,
      borderRadius: (SEAT + 4) / 2,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: tennisHeroArt.heroMint,
      backgroundColor: tennisHeroArt.heroGreenDeep,
    },
    overlap: {
      marginStart: -10,
    },
    cta: {
      alignSelf: "stretch",
      minHeight: minTouchTargetPx,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      backgroundColor: tennisColors.lime,
    },
    ctaLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 15,
      color: tennisColors.limeText,
    },
  }),
);
