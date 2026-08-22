import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * The time window Discover was opened with, and the way back out of it.
 *
 * Drawn in the selected state of `DiscoverMatchChips` rather than a style of
 * its own, because that is what it is: an applied filter. Same padding, radius
 * and label size, so it reads as one row with the toggles above it.
 *
 * The whole chip removes the filter rather than a separate cross target. A
 * cross inside a chip is a touch target inside a touch target, and there is no
 * second action here worth the ambiguity -- tapping an applied filter to drop
 * it is the only thing anyone wants from this control.
 */
export function DiscoverTimeChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const { rowDirection } = useLayoutDirection();

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("discover.clearTimeFilter", { slot: label })}
        onPress={onClear}
        style={({ pressed }) => [
          styles.chip,
          { flexDirection: rowDirection },
          pressed && styles.chipPressed,
        ]}
      >
        <AppText style={styles.chipLabel} maxLines={1}>
          {label}
        </AppText>
        <Icon name="close" size={14} color={tennisColors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  chip: {
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tennisRadii.lg,
    backgroundColor: tennisColors.primary,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipLabel: {
    flexShrink: 1,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    color: tennisColors.white,
  },
});
