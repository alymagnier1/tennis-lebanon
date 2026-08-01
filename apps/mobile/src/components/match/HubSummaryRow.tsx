import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../AppText";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function HubSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <AppText style={[styles.label, { writingDirection }]} maxLines={2}>
        {label}
      </AppText>
      <AppText style={[styles.value, { writingDirection }]} maxLines={3}>
        {value}
      </AppText>
    </View>
  );
}

export function HubDestructiveLink({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.destructive,
        pressed && !disabled && styles.destructivePressed,
        disabled && styles.destructiveDisabled,
      ]}
    >
      <AppText style={styles.destructiveLabel}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    color: tennisColors.mutedForeground,
  },
  value: {
    flex: 1.2,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.primaryDark,
    textAlign: "right",
  },
  destructive: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  destructivePressed: {
    opacity: 0.85,
  },
  destructiveDisabled: {
    opacity: 0.5,
  },
  destructiveLabel: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.danger,
  },
});
