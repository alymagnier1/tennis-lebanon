import { memo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { Avatar } from "../AppUi";
import { AppText } from "../AppText";
import { Icon, type IconName } from "../Icon";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { shortPlayerName } from "../../lib/home-v5";
import { useLayoutDirection } from "../../lib/layout-direction";
import { skillBandColor, skillBandFill } from "../../lib/skill-band-theme";
import { useTennisTheme } from "../../providers/ThemeProvider";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

function FooterMetaItem({
  icon,
  label,
  accessibilityLabel,
  writingDirection,
  rowDirection,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  writingDirection: "ltr" | "rtl";
  rowDirection: "row" | "row-reverse";
}) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[styles.footerMetaItem, { flexDirection: rowDirection }]}
    >
      <Icon name={icon} size={16} color={tennisColors.mutedForeground} />
      <AppText
        style={[styles.footerMetaText, { writingDirection }]}
        maxLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}

/**
 * The full name when it fits on the line, otherwise "Alexandra J.". The full
 * name is measured off-screen at its natural width; the visible line still
 * ellipsizes if even the short form is too long.
 */
function FittingName({
  name,
  writingDirection,
}: {
  name: string;
  writingDirection: "ltr" | "rtl";
}) {
  const [slotWidth, setSlotWidth] = useState(0);
  const [fullWidth, setFullWidth] = useState(0);
  const tooLong = slotWidth > 0 && fullWidth > slotWidth + 0.5;
  const shown = tooLong ? shortPlayerName(name) : name;

  return (
    <View
      style={styles.nameSlot}
      onLayout={(event) => setSlotWidth(event.nativeEvent.layout.width)}
    >
      <AppText style={[styles.name, { writingDirection }]} maxLines={1}>
        {shown}
      </AppText>
      <View
        style={styles.nameMeasure}
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <AppText
          style={styles.name}
          onLayout={(event) => setFullWidth(event.nativeEvent.layout.width)}
        >
          {name}
        </AppText>
      </View>
    </View>
  );
}

export const DiscoverPlayerCard = memo(function DiscoverPlayerCard({
  player,
  name,
  locationLabel,
  levelBadgeLabel,
  availability,
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
  /** Days beside the clock ("Thu · Fri"); the label adds "Available". */
  availability?: { text: string; accessibilityLabel: string } | null;
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
              size={72}
              borderRadius={14}
            />
            <View style={styles.identity}>
              <View style={[styles.nameRow, { flexDirection: rowDirection }]}>
                <FittingName name={name} writingDirection={writingDirection} />
                <View
                  style={[styles.levelBadge, { backgroundColor: bandFill }]}
                >
                  <AppText
                    style={[styles.levelBadgeText, { color: bandColor }]}
                  >
                    {levelBadgeLabel}
                  </AppText>
                </View>
              </View>
              {locationLabel ? (
                <AppText
                  style={[styles.area, { writingDirection }]}
                  maxLines={1}
                >
                  {locationLabel}
                </AppText>
              ) : null}
              {clubsTag ? (
                <AppText
                  style={[styles.area, { writingDirection }]}
                  maxLines={1}
                >
                  {clubsTag}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>

      <View style={[styles.actionFooter, { flexDirection: rowDirection }]}>
        <View style={styles.footerMeta}>
          {availability ? (
            <FooterMetaItem
              icon="clock"
              label={availability.text}
              accessibilityLabel={availability.accessibilityLabel}
              writingDirection={writingDirection}
              rowDirection={rowDirection}
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
            hitSlop={{ top: 8, bottom: 8 }}
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
      padding: 12,
    },
    bodyPressed: {
      opacity: 0.94,
    },
    header: {
      alignItems: "center",
      gap: 12,
    },
    identity: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    nameRow: {
      alignItems: "center",
      gap: 8,
    },
    nameSlot: {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
    },
    nameMeasure: {
      position: "absolute",
      top: 0,
      left: 0,
      width: 10000,
      flexDirection: "row",
      opacity: 0,
    },
    name: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 18,
      lineHeight: 23,
      color: tennisColors.primaryDark,
      letterSpacing: -0.2,
    },
    area: {
      flexShrink: 1,
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
    },
    levelBadge: {
      borderRadius: tennisRadii.pill,
      paddingHorizontal: 12,
      paddingVertical: 3,
      flexShrink: 0,
    },
    levelBadgeText: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 13,
    },
    actionFooter: {
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: tennisColors.cardFooter,
    },
    footerMeta: {
      flex: 1,
      minWidth: 0,
    },
    footerMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      flexShrink: 1,
      maxWidth: "100%",
    },
    footerMetaText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14.5,
      lineHeight: 19,
      color: tennisColors.mutedForeground,
      flexShrink: 1,
    },
    actionPill: {
      flexShrink: 0,
      minHeight: 34,
      minWidth: 112,
      paddingHorizontal: 18,
      paddingVertical: 4,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tennisColors.lime,
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
      fontSize: 15,
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
