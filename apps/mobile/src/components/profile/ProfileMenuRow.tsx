import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function ProfileMenuRow({
  icon,
  label,
  value,
  subtitle,
  onPress,
  showDivider = true,
  showChevron = true,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  /** Secondary line under the label (current value or short hint). */
  value?: string | null;
  /** Alias for value — prefer for descriptive hints. */
  subtitle?: string | null;
  onPress: () => void;
  showDivider?: boolean;
  showChevron?: boolean;
  tone?: "default" | "danger";
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();
  const isDanger = tone === "danger";
  const detail = subtitle ?? value ?? null;
  const a11yLabel = detail ? `${label}. ${detail}` : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { flexDirection: rowDirection },
        pressed && styles.rowPressed,
        showDivider && styles.rowDivider,
      ]}
    >
      <View
        style={[styles.iconCircle, isDanger ? styles.iconCircleDanger : null]}
      >
        {icon}
      </View>
      <View style={styles.labelBlock}>
        <AppText
          style={[
            styles.label,
            isDanger ? styles.labelDanger : null,
            { writingDirection },
          ]}
        >
          {label}
        </AppText>
        {detail ? (
          <AppText
            style={[styles.value, { writingDirection }]}
            maxLines={2}
          >
            {detail}
          </AppText>
        ) : null}
      </View>
      {showChevron ? (
        <Icon
          name="chevron"
          size={14}
          color={isDanger ? tennisColors.accent : tennisColors.mutedForeground}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: tennisColors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconCircleDanger: {
    backgroundColor: "#FEF0E7",
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.primaryDark,
  },
  labelDanger: {
    color: tennisColors.accent,
  },
  value: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    color: tennisColors.mutedForeground,
  },
});
