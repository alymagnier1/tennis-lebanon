import { memo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { type OpenMatchCard } from "@tennis-lebanon/api";
import { canShowJoinAction } from "@tennis-lebanon/domain";
import { minTouchTargetPx } from "@tennis-lebanon/ui";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { FirstFitText } from "../FirstFitText";
import { Icon } from "../Icon";
import { SEMANTIC_TONE_ICONS } from "../SemanticBadge";
import { createLiveSheet } from "../../theme/create-live-sheet";
import {
  clubLineCandidates,
  clubNamesFromList,
  matchCardAreaLabel,
} from "../../lib/match-clubs";
import { matchHubLevelSummary } from "../../lib/match-hub-summaries";
import { openMatchCardDateTimeLabel } from "../../lib/open-match-card-time";
import { openMatchRosterProps } from "../../lib/open-match-roster";
import { openMatchScarcityBadges } from "../../lib/open-match-scarcity";
import { useLayoutDirection } from "../../lib/layout-direction";
import { shortPlayerName } from "../../lib/home-v5";
import { tennisColors, tennisSemantic } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

const HOST_AVATAR_SIZE = 48;
const HOST_AVATAR_RADIUS = 10;
const ROSTER_OVERLAP = 12;

function HostRosterStack({
  roster,
  rowDirection,
}: {
  roster: { name: string; avatarPath?: string | null }[];
  rowDirection: "row" | "row-reverse";
}) {
  const overlapSide = rowDirection === "row" ? "marginLeft" : "marginRight";

  return (
    <View style={[styles.rosterStack, { flexDirection: rowDirection }]}>
      {roster.map((player, index) => (
        <View
          key={`${player.name}-${index}`}
          style={[
            styles.rosterRing,
            { zIndex: roster.length - index },
            index > 0 && { [overlapSide]: -ROSTER_OVERLAP },
          ]}
        >
          <Avatar
            name={player.name}
            avatarPath={player.avatarPath}
            size={HOST_AVATAR_SIZE}
            borderRadius={HOST_AVATAR_RADIUS}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Open-match listing: when and what on top, who is in it and a Join pill
 * below. Without `onJoinPress` the whole card opens the hub and the pill is
 * only a cue; with it, the pill joins in place and the rest opens the hub.
 */
export const OpenMatchListCard = memo(function OpenMatchListCard({
  match,
  locale,
  onPress,
  onJoinPress,
  joinLoading = false,
}: {
  match: OpenMatchCard;
  locale: string;
  onPress: () => void;
  onJoinPress?: () => void;
  joinLoading?: boolean;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const areaLabel = matchCardAreaLabel(match.zones, locale, { compact: true });
  const dateTimeLabel =
    openMatchCardDateTimeLabel(match) ?? t("home.noTimeYet");
  const clubNames = clubNamesFromList(match.preferred_clubs);
  const clubCandidates = clubLineCandidates(clubNames);
  const facts = [t(`formats.${match.format}`), areaLabel]
    .filter(Boolean)
    .join(" · ");
  const roster = openMatchRosterProps(match, t);
  const hostName = shortPlayerName(match.creator_display_name);
  const hostLine = roster.hostOthers
    ? `${hostName} ${roster.hostOthers.label}`
    : hostName;
  const levelRange = { min_skill: match.min_skill, max_skill: match.max_skill };
  const level = matchHubLevelSummary(levelRange, t);
  const spokenLevel = matchHubLevelSummary(levelRange, t, { spoken: true });
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
  const accessibilityLabel = [
    dateTimeLabel,
    facts,
    clubNames.join(", "),
    [roster.hostOthers?.accessibilityLabel ?? hostName, spokenLevel]
      .filter(Boolean)
      .join(", "),
    badge?.label,
  ]
    .filter(Boolean)
    .map((part) => part?.replace(/\.$/, ""))
    .join(". ");

  const top = (
    <View style={styles.topText}>
      <View style={[styles.top, { flexDirection: rowDirection }]}>
        <AppText style={[styles.time, { writingDirection }]} maxLines={1}>
          {dateTimeLabel}
        </AppText>
        {badge && badgePalette ? (
          <View
            style={[
              styles.tag,
              {
                flexDirection: rowDirection,
                backgroundColor: badgePalette.fill,
              },
            ]}
          >
            <Icon
              name={SEMANTIC_TONE_ICONS[badge.tone]}
              size={15}
              color={badgePalette.text}
            />
            <AppText
              style={[styles.tagLabel, { color: badgePalette.text }]}
              maxLines={1}
            >
              {badge.label}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText style={[styles.facts, { writingDirection }]} maxLines={1}>
        {facts}
      </AppText>
      {clubCandidates.length > 0 ? (
        <FirstFitText
          candidates={clubCandidates}
          suffix={clubNames.length > 1 ? `+${clubNames.length - 1}` : undefined}
          style={[styles.facts, { writingDirection }]}
          rowDirection={rowDirection}
        />
      ) : null}
    </View>
  );

  const host = (
    <>
      {roster.hostRoster && roster.hostRoster.length > 1 ? (
        <HostRosterStack
          roster={roster.hostRoster}
          rowDirection={rowDirection}
        />
      ) : (
        <Avatar
          name={match.creator_display_name}
          avatarPath={match.creator_avatar_path}
          size={HOST_AVATAR_SIZE}
          borderRadius={HOST_AVATAR_RADIUS}
        />
      )}
      <View style={styles.hostText}>
        <AppText style={[styles.hostName, { writingDirection }]} maxLines={1}>
          {hostLine}
        </AppText>
        {level ? (
          <AppText
            style={[styles.hostLevel, { writingDirection }]}
            maxLines={2}
          >
            {level}
          </AppText>
        ) : null}
      </View>
    </>
  );

  const joinText = joinLabel ? (
    <AppText style={styles.joinLabel} maxLines={1}>
      {joinLabel}
    </AppText>
  ) : null;

  if (!onJoinPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={joinLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {top}
        <Foot rowDirection={rowDirection}>
          <View style={[styles.host, { flexDirection: rowDirection }]}>
            {host}
          </View>
          {joinText ? <View style={styles.join}>{joinText}</View> : null}
        </Foot>
      </Pressable>
    );
  }

  // Siblings, not nested: a button inside the card's button breaks keyboard
  // navigation and screen readers, and is invalid HTML on web.
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {top}
      </Pressable>
      <Foot rowDirection={rowDirection}>
        <Pressable
          accessible={false}
          focusable={false}
          importantForAccessibility="no-hide-descendants"
          onPress={onPress}
          style={({ pressed }) => [
            styles.host,
            { flexDirection: rowDirection },
            pressed && styles.pressed,
          ]}
        >
          {host}
        </Pressable>
        {joinText ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={joinLabel}
            accessibilityState={{ busy: joinLoading, disabled: joinLoading }}
            disabled={joinLoading}
            onPress={onJoinPress}
            style={({ pressed }) => [
              styles.join,
              pressed && !joinLoading && styles.pressed,
            ]}
          >
            {joinLoading ? (
              <ActivityIndicator color={tennisColors.limeText} />
            ) : (
              joinText
            )}
          </Pressable>
        ) : null}
      </Foot>
    </View>
  );
});

function Foot({
  rowDirection,
  children,
}: {
  rowDirection: "row" | "row-reverse";
  children: ReactNode;
}) {
  return (
    <View style={[styles.foot, { flexDirection: rowDirection }]}>
      {children}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      padding: 16,
      gap: 12,
      borderRadius: 20,
      backgroundColor: tennisColors.card,
      shadowColor: "#0D1117",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
    pressed: {
      opacity: 0.7,
    },
    top: {
      alignItems: "center",
      gap: 10,
    },
    topText: {
      gap: 2,
    },
    time: {
      flex: 1,
      minWidth: 0,
      fontFamily: tennisFontFamily.heading,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.3,
      color: tennisColors.primaryDark,
    },
    facts: {
      fontFamily: tennisFontFamily.body,
      fontSize: 15,
      lineHeight: 20,
      color: tennisColors.mutedForeground,
    },
    tag: {
      flexShrink: 0,
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    tagLabel: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
      lineHeight: 17,
    },
    foot: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tennisColors.border,
    },
    host: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 12,
    },
    rosterStack: {
      flexShrink: 0,
      alignItems: "center",
    },
    rosterRing: {
      borderWidth: 2,
      borderColor: tennisColors.card,
      borderRadius: HOST_AVATAR_RADIUS + 2,
    },
    hostText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    hostName: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 16,
      lineHeight: 21,
      color: tennisColors.primaryDark,
    },
    hostLevel: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 19,
      color: tennisColors.mutedForeground,
    },
    join: {
      minHeight: minTouchTargetPx,
      minWidth: 108,
      paddingHorizontal: 20,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      backgroundColor: tennisColors.lime,
    },
    joinLabel: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 17,
      color: tennisColors.limeText,
    },
  }),
);
