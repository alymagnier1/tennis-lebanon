import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { AppText } from "./AppText";
import { tennisColors } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

/** Shared count pill for icon overlays (bell, tab bar, etc.). */
export const COUNT_BADGE_SIZE = 22;

type CountBadgeTone = "accent" | "violet";

/**
 * Numeric count that sits on a corner of an icon and overhangs its bounds.
 * Parent should allow overflow (default) so the pill is not clipped.
 */
export function CountBadge({
  label,
  tone = "accent",
  style,
}: {
  label: string;
  tone?: CountBadgeTone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        tone === "violet" ? styles.badgeViolet : styles.badgeAccent,
        style,
      ]}
    >
      <AppText style={styles.text} maxLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    badge: {
      position: "absolute",
      top: -5,
      end: -5,
      minWidth: COUNT_BADGE_SIZE,
      height: COUNT_BADGE_SIZE,
      borderRadius: COUNT_BADGE_SIZE / 2,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: tennisColors.background,
      zIndex: 2,
    },
    badgeAccent: {
      backgroundColor: tennisColors.accent,
    },
    badgeViolet: {
      backgroundColor: tennisColors.violet,
    },
    text: {
      color: tennisColors.white,
      fontSize: 11,
      lineHeight: 13,
      fontFamily: tennisFontFamily.bodySemi,
    },
  }),
);
