import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { Avatar } from "../AppUi";
import { AppText } from "../AppText";
import { Icon, type IconName } from "../Icon";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { joinedListTypeSize } from "../../lib/match-clubs";
import { skillBandColor, skillBandFill } from "../../lib/skill-band-theme";
import { useTennisTheme } from "../../providers/ThemeProvider";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

function FooterMetaItem({
  icon,
  label,
  writingDirection,
  rowDirection,
  fontSize,
  lineHeight,
}: {
  icon: IconName;
  label: string;
  writingDirection: "ltr" | "rtl";
  rowDirection: "row" | "row-reverse";
  fontSize?: number;
  lineHeight?: number;
}) {
  return (
    <View style={[styles.footerMetaItem, { flexDirection: rowDirection }]}>
      <Icon name={icon} size={16} color={tennisColors.mutedForeground} />
      <AppText
        style={[
          styles.footerMetaText,
          { writingDirection },
          fontSize != null ? { fontSize, lineHeight } : null,
        ]}
        maxLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}

export const DiscoverPlayerCard = memo(function DiscoverPlayerCard({
  player,
  name,
  locationLabel,
  levelBadgeLabel,
  matchesPlayedLabel,
  formatTag,
  availabilityTags,
  clubsTag,
  profileAccessibilityLabel,
  primaryLabel,
  primaryLoading = false,
  primaryDisabled = false,
  onProfilePress,
  onPrimaryPress,
}: {
  player: CompatiblePlayerCard;
  name: string;
  locationLabel: string;
  levelBadgeLabel: string;
  matchesPlayedLabel: string;
  formatTag?: string | null;
  availabilityTags: string[];
  clubsTag?: string | null;
  profileAccessibilityLabel: string;
  primaryLabel: string;
  primaryLoading?: boolean;
  /** Invited / already in the match — keep the layout, drop the tap. */
  primaryDisabled?: boolean;
  onProfilePress: () => void;
  onPrimaryPress: () => void;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();
  const { scheme } = useTennisTheme();
  const isDark = scheme === "dark";
  const bandColor = skillBandColor(player.skill_band);
  const bandFill = skillBandFill(player.skill_band);
  const availabilityLabel = availabilityTags.filter(Boolean).join(" · ");
  const clubCount = clubsTag ? clubsTag.split(" · ").filter(Boolean).length : 0;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={profileAccessibilityLabel}
        onPress={onProfilePress}
        style={({ pressed }) => [pressed && styles.bodyPressed]}
      >
        <View style={styles.body}>
          <View style={[styles.header, { flexDirection: rowDirection }]}>
            <Avatar
              name={name}
              avatarPath={player.avatar_path}
              size={64}
              borderRadius={14}
            />
            <View style={styles.identity}>
              <AppText style={[styles.name, { writingDirection }]} maxLines={1}>
                {name}
              </AppText>
              <AppText
                style={[styles.matchesPlayed, { writingDirection }]}
                maxLines={1}
              >
                {matchesPlayedLabel}
              </AppText>
              {locationLabel ? (
                <AppText
                  style={[styles.area, { writingDirection }]}
                  maxLines={1}
                >
                  {locationLabel}
                </AppText>
              ) : null}
            </View>
            <View style={[styles.levelBadge, { backgroundColor: bandFill }]}>
              <AppText style={[styles.levelBadgeText, { color: bandColor }]}>
                {levelBadgeLabel}
              </AppText>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={[styles.actionFooter, { flexDirection: rowDirection }]}>
        <View style={styles.footerMeta}>
          {formatTag ? (
            <FooterMetaItem
              icon="court"
              label={formatTag}
              writingDirection={writingDirection}
              rowDirection={rowDirection}
            />
          ) : null}
          {availabilityLabel ? (
            <FooterMetaItem
              icon="clock"
              label={availabilityLabel}
              writingDirection={writingDirection}
              rowDirection={rowDirection}
            />
          ) : null}
          {clubsTag ? (
            <FooterMetaItem
              icon="court"
              label={clubsTag}
              writingDirection={writingDirection}
              rowDirection={rowDirection}
              {...joinedListTypeSize(clubCount)}
            />
          ) : null}
        </View>
        {primaryDisabled && !primaryLoading ? (
          <View
            accessibilityRole="text"
            style={[styles.actionPill, styles.actionPillDisabledStatic]}
          >
            <AppText
              style={[
                styles.actionPillText,
                styles.actionPillTextDisabled,
                { writingDirection },
              ]}
              maxLines={1}
            >
              {primaryLabel}
            </AppText>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            disabled={primaryLoading || primaryDisabled}
            onPress={onPrimaryPress}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => [
              styles.actionPill,
              isDark && styles.actionPillDark,
              pressed && !primaryLoading && styles.actionPillPressed,
              primaryLoading && styles.actionPillDisabled,
            ]}
          >
            {primaryLoading ? (
              <ActivityIndicator
                color={isDark ? tennisColors.onViolet : tennisColors.limeText}
              />
            ) : (
              <AppText
                style={[
                  styles.actionPillText,
                  { writingDirection },
                  isDark && styles.actionPillTextDark,
                ]}
                maxLines={1}
              >
                {primaryLabel}
              </AppText>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      borderRadius: 20,
      backgroundColor: tennisColors.card,
      overflow: "hidden",
      shadowColor: "#0D1117",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
    body: {
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    bodyPressed: {
      opacity: 0.94,
    },
    header: {
      alignItems: "flex-start",
      gap: 12,
    },
    identity: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
      gap: 2,
    },
    name: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 16,
      color: tennisColors.primaryDark,
    },
    matchesPlayed: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.mutedForeground,
    },
    area: {
      fontFamily: tennisFontFamily.body,
      fontSize: 11,
      color: tennisColors.mutedForeground,
    },
    levelBadge: {
      alignSelf: "flex-start",
      borderRadius: tennisRadii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      flexShrink: 0,
    },
    levelBadgeText: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 11,
    },
    actionFooter: {
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: tennisColors.muted,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tennisColors.border,
    },
    footerMeta: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    footerMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
      maxWidth: "100%",
    },
    footerMetaText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
      flexShrink: 1,
    },
    actionPill: {
      flexShrink: 0,
      minHeight: 36,
      minWidth: 120,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tennisColors.white,
    },
    actionPillDark: {
      backgroundColor: tennisColors.violet,
    },
    actionPillPressed: {
      opacity: 0.88,
    },
    actionPillDisabled: {
      opacity: 0.7,
    },
    actionPillDisabledStatic: {
      backgroundColor: tennisColors.card,
      borderWidth: 1,
      borderColor: tennisColors.border,
    },
    actionPillText: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 13,
      letterSpacing: -0.1,
      color: tennisColors.limeText,
      textAlign: "center",
    },
    actionPillTextDark: {
      color: tennisColors.onViolet,
    },
    actionPillTextDisabled: {
      color: tennisColors.mutedForeground,
    },
  }),
);
