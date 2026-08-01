import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function ProfileMenuRow({
  icon,
  label,
  onPress,
  showDivider = true,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { flexDirection: rowDirection },
        pressed && styles.rowPressed,
        showDivider && styles.rowDivider,
      ]}
    >
      <View style={styles.iconSlot}>{icon}</View>
      <AppText style={[styles.label, { writingDirection }]}>{label}</AppText>
      <Icon name="chevron" size={14} color={tennisColors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  iconSlot: {
    width: 24,
    alignItems: "center",
  },
  label: {
    flex: 1,
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    color: tennisColors.primaryDark,
  },
});
