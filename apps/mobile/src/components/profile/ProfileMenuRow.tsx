import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
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
  disabled = false,
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
  disabled?: boolean;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();
  const isDanger = tone === "danger";
  const detail = subtitle ?? value ?? null;
  const a11yLabel = detail ? `${label}. ${detail}` : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { flexDirection: rowDirection },
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
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
          <AppText style={[styles.value, { writingDirection }]} maxLines={2}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {showChevron ? (
        <Icon
          name="chevron"
          size={14}
          color={isDanger ? tennisColors.danger : tennisColors.mutedForeground}
        />
      ) : null}
    </Pressable>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    row: {
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      minHeight: 44,
    },
    rowPressed: {
      opacity: 0.85,
    },
    rowDisabled: {
      opacity: 0.55,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: tennisColors.border,
    },
    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: tennisRadii.control,
      backgroundColor: tennisColors.secondary,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    iconCircleDanger: {
      backgroundColor: tennisColors.dangerSoft,
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
      color: tennisColors.danger,
    },
    value: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
  }),
);
